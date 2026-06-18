import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import {
  getUploadById,
  getUploadFilePath,
  openUploadReadStream,
} from "@/lib/links/uploads";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function toAsciiFilename(input: string) {
  const sanitized = input
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim();

  return sanitized || "download";
}

function createContentDisposition(filename: string) {
  const fallback = toAsciiFilename(filename);
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const upload = await getUploadById(id);

    if (!upload) {
      return new NextResponse("Not found.", { status: 404 });
    }

    try {
      await fs.access(getUploadFilePath(upload.storedName));
    } catch {
      return new NextResponse("Not found.", { status: 404 });
    }

    const stream = openUploadReadStream(upload.storedName);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": upload.mimeType || "application/octet-stream",
        "Content-Disposition": createContentDisposition(upload.originalName),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Unable to load download.", { status: 500 });
  }
}
