import { NextRequest, NextResponse } from "next/server";
import { deleteLink, updateLink } from "@/lib/links/store";
import { isLinksAdminAuthenticated } from "@/lib/links/auth";

interface RouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug: existingSlug } = await context.params;
  const body = await request.json().catch(() => null);
  const nextSlug = typeof body?.slug === "string" ? body.slug : "";
  const nextTargetUrl = typeof body?.targetUrl === "string" ? body.targetUrl : "";

  try {
    const link = await updateLink(existingSlug, nextSlug, nextTargetUrl);
    return NextResponse.json({ link });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update link.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    await deleteLink(slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete link.",
      },
      { status: 400 },
    );
  }
}
