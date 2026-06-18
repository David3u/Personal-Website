import { NextRequest, NextResponse } from "next/server";
import { isLinksAdminAuthenticated } from "@/lib/links/auth";
import {
  createUpload,
  getUploadDownloadPath,
  listUploads,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/links/uploads";

function errorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status =
    message === "A file is required." ||
    message === "File cannot be empty." ||
    message === "File exceeds the 100 MB limit."
      ? 400
      : 500;

  return NextResponse.json({ error: message }, { status });
}

function serializeUpload(upload: {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
}) {
  return {
    id: upload.id,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    size: upload.size,
    createdAt: upload.createdAt,
    downloadUrl: getUploadDownloadPath(upload.id),
  };
}

export async function GET(request: NextRequest) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uploads = await listUploads();
    return NextResponse.json({ uploads: uploads.map(serializeUpload) });
  } catch (error) {
    return errorResponse(error, "Unable to load uploads.");
  }
}

export async function POST(request: NextRequest) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 100 MB limit." },
      { status: 400 },
    );
  }

  try {
    const upload = await createUpload(file, "admin");
    return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to upload file.");
  }
}
