import { NextRequest, NextResponse } from "next/server";
import { isLinksAdminAuthenticated, LINKS_SESSION_COOKIE } from "@/lib/links/auth";

export async function POST(request: NextRequest) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: LINKS_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/links",
    maxAge: 0,
  });
  return response;
}
