import crypto from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface UploadedFileRecord {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: string;
}

interface UploadManifest {
  uploads: UploadedFileRecord[];
}

export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const UPLOADS_FILES_DIR = path.join(UPLOADS_ROOT, "files");
const UPLOADS_MANIFEST_PATH = path.join(UPLOADS_ROOT, "manifest.json");
const UPLOAD_ID_REGEX = /^[a-f0-9]{32}$/;
const INVALID_MANIFEST_ERROR = "Upload manifest is invalid.";

let manifestWriteQueue = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

async function ensureUploadStore() {
  await fs.mkdir(UPLOADS_FILES_DIR, { recursive: true });

  try {
    await fs.access(UPLOADS_MANIFEST_PATH);
  } catch {
    const initial: UploadManifest = { uploads: [] };
    await fs.writeFile(UPLOADS_MANIFEST_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readManifest(): Promise<UploadManifest> {
  await ensureUploadStore();
  const raw = await fs.readFile(UPLOADS_MANIFEST_PATH, "utf8");

  try {
    const parsed = JSON.parse(raw) as UploadManifest;
    if (!parsed || !Array.isArray(parsed.uploads)) {
      throw new Error(INVALID_MANIFEST_ERROR);
    }

    return {
      uploads: parsed.uploads.map((entry) => {
        if (
          !entry ||
          typeof entry.id !== "string" ||
          typeof entry.originalName !== "string" ||
          typeof entry.storedName !== "string"
        ) {
          throw new Error(INVALID_MANIFEST_ERROR);
        }

        return {
          id: entry.id,
          originalName: entry.originalName,
          storedName: entry.storedName,
          mimeType:
            typeof entry.mimeType === "string" && entry.mimeType.trim()
              ? entry.mimeType
              : "application/octet-stream",
          size: typeof entry.size === "number" && Number.isFinite(entry.size) ? entry.size : 0,
          createdAt:
            typeof entry.createdAt === "string" && entry.createdAt
              ? entry.createdAt
              : nowIso(),
          uploadedBy:
            typeof entry.uploadedBy === "string" && entry.uploadedBy
              ? entry.uploadedBy
              : "admin",
        };
      }),
    };
  } catch {
    throw new Error(INVALID_MANIFEST_ERROR);
  }
}

async function writeManifest(manifest: UploadManifest) {
  await fs.writeFile(UPLOADS_MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function sanitizeFileName(input: string) {
  const basename = path.basename(input).normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
  const sanitized = basename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");

  return sanitized || "file";
}

function normalizeUploadId(id: string) {
  const normalized = id.trim().toLowerCase();
  if (!UPLOAD_ID_REGEX.test(normalized)) {
    throw new Error("Upload not found.");
  }
  return normalized;
}

function createUploadId() {
  return crypto.randomBytes(16).toString("hex");
}

async function withManifestWriteLock<T>(task: () => Promise<T>) {
  const next = manifestWriteQueue.then(task, task);
  manifestWriteQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function getUploadDownloadPath(id: string) {
  return `/downloads/${id}`;
}

export function getUploadFilePath(storedName: string) {
  return path.join(UPLOADS_FILES_DIR, storedName);
}

export function openUploadReadStream(storedName: string) {
  return createReadStream(getUploadFilePath(storedName));
}

export async function listUploads() {
  const manifest = await readManifest();
  return manifest.uploads.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getUploadById(id: string) {
  let normalizedId: string;
  try {
    normalizedId = normalizeUploadId(id);
  } catch {
    return null;
  }

  const manifest = await readManifest();
  return manifest.uploads.find((entry) => entry.id === normalizedId) ?? null;
}

export async function createUpload(file: File, uploadedBy: string) {
  if (!(file instanceof File)) {
    throw new Error("A file is required.");
  }

  if (file.size <= 0) {
    throw new Error("File cannot be empty.");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("File exceeds the 100 MB limit.");
  }

  await ensureUploadStore();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = createUploadId();
    const originalName = file.name?.trim() || "file";
    const storedName = `${id}--${sanitizeFileName(originalName)}`;
    const filePath = getUploadFilePath(storedName);

    const upload: UploadedFileRecord = {
      id,
      originalName,
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      createdAt: nowIso(),
      uploadedBy,
    };

    await pipeline(
      Readable.fromWeb(
        file.stream() as unknown as import("node:stream/web").ReadableStream,
      ),
      createWriteStream(filePath),
    );

    try {
      await withManifestWriteLock(async () => {
        const manifest = await readManifest();

        if (manifest.uploads.some((entry) => entry.id === id)) {
          throw new Error("UPLOAD_ID_COLLISION");
        }

        manifest.uploads.push(upload);
        await writeManifest(manifest);
      });
    } catch (error) {
      await fs.rm(filePath, { force: true });

      if (error instanceof Error && error.message === "UPLOAD_ID_COLLISION") {
        continue;
      }

      throw error;
    }

    return upload;
  }

  throw new Error("Unable to generate a unique upload ID.");
}

export async function deleteUpload(id: string) {
  return withManifestWriteLock(async () => {
    const normalizedId = normalizeUploadId(id);
    const manifest = await readManifest();
    const uploadIndex = manifest.uploads.findIndex((entry) => entry.id === normalizedId);

    if (uploadIndex < 0) {
      throw new Error("Upload not found.");
    }

    const [upload] = manifest.uploads.splice(uploadIndex, 1);
    await writeManifest(manifest);
    await fs.rm(getUploadFilePath(upload.storedName), { force: true });

    return upload;
  });
}
