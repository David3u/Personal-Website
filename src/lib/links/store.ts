import { promises as fs } from "node:fs";
import path from "node:path";

export interface ShortLink {
  slug: string;
  targetUrl: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface LinkStore {
  links: ShortLink[];
}

const STORE_PATH = path.join(process.cwd(), "src/data/short-links.json");
const SLUG_REGEX = /^[a-z0-9_-]{1,50}$/;

function nowIso() {
  return new Date().toISOString();
}

async function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: LinkStore = { links: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<LinkStore> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");

  try {
    const parsed = JSON.parse(raw) as LinkStore;
    if (!parsed || !Array.isArray(parsed.links)) {
      return { links: [] };
    }

    return {
      links: parsed.links
        .filter((entry) => entry && typeof entry.slug === "string" && typeof entry.targetUrl === "string")
        .map((entry) => ({
          slug: entry.slug.toLowerCase(),
          targetUrl: entry.targetUrl,
          createdAt: entry.createdAt || nowIso(),
          updatedAt: entry.updatedAt || entry.createdAt || nowIso(),
          createdBy: entry.createdBy || "admin",
        })),
    };
  } catch {
    return { links: [] };
  }
}

async function writeStore(store: LinkStore) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function normalizeSlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_REGEX.test(normalized)) {
    throw new Error("Slug must be 1-50 chars using letters, numbers, '-' or '_'.");
  }
  return normalized;
}

export function normalizeTargetUrl(input: string) {
  const raw = input.trim();
  if (!raw) {
    throw new Error("URL is required.");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Please enter a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  return parsed.toString();
}

export async function listLinks() {
  const store = await readStore();
  return store.links.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getLinkBySlug(slug: string) {
  let normalized: string;
  try {
    normalized = normalizeSlug(slug);
  } catch {
    return null;
  }

  const store = await readStore();
  return store.links.find((entry) => entry.slug === normalized) ?? null;
}

export async function createLink(slug: string, targetUrl: string, createdBy: string) {
  const normalizedSlug = normalizeSlug(slug);
  const normalizedTarget = normalizeTargetUrl(targetUrl);
  const store = await readStore();

  if (store.links.some((entry) => entry.slug === normalizedSlug)) {
    throw new Error("That short code is already in use.");
  }

  const timestamp = nowIso();
  const link: ShortLink = {
    slug: normalizedSlug,
    targetUrl: normalizedTarget,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy,
  };

  store.links.push(link);
  await writeStore(store);
  return link;
}

export async function updateLink(existingSlug: string, nextSlug: string, nextTargetUrl: string) {
  const normalizedExistingSlug = normalizeSlug(existingSlug);
  const normalizedNextSlug = normalizeSlug(nextSlug);
  const normalizedNextTargetUrl = normalizeTargetUrl(nextTargetUrl);
  const store = await readStore();

  const linkIndex = store.links.findIndex((entry) => entry.slug === normalizedExistingSlug);
  if (linkIndex < 0) {
    throw new Error("Link not found.");
  }

  if (
    normalizedExistingSlug !== normalizedNextSlug &&
    store.links.some((entry) => entry.slug === normalizedNextSlug)
  ) {
    throw new Error("That short code is already in use.");
  }

  const current = store.links[linkIndex];
  const updated: ShortLink = {
    ...current,
    slug: normalizedNextSlug,
    targetUrl: normalizedNextTargetUrl,
    updatedAt: nowIso(),
  };

  store.links[linkIndex] = updated;
  await writeStore(store);
  return updated;
}

export async function deleteLink(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  const store = await readStore();
  const nextLinks = store.links.filter((entry) => entry.slug !== normalizedSlug);

  if (nextLinks.length === store.links.length) {
    throw new Error("Link not found.");
  }

  await writeStore({ links: nextLinks });
}
