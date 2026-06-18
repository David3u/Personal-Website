import { NextRequest, NextResponse } from "next/server";
import { isLinksAdminAuthenticated } from "@/lib/links/auth";
import { deleteUpload } from "@/lib/links/uploads";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteUpload(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete upload.";
    const status = message === "Upload not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
