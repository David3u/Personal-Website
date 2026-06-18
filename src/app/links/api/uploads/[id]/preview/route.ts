import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { isLinksAdminAuthenticated } from "@/lib/links/auth";
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

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Unable to load preview.", { status: 500 });
  }
}
