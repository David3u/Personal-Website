import { NextRequest, NextResponse } from "next/server";
import { createLink, listLinks } from "@/lib/links/store";
import { isLinksAdminAuthenticated } from "@/lib/links/auth";

export async function GET(request: NextRequest) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await listLinks();
  return NextResponse.json({ links });
}

export async function POST(request: NextRequest) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl : "";

  try {
    const created = await createLink(slug, targetUrl, "admin");
    return NextResponse.json({ link: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create link.",
      },
      { status: 400 },
    );
  }
}
