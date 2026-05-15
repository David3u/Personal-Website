import { NextRequest, NextResponse } from "next/server";
import { isLinksAdminAuthenticated } from "@/lib/links/auth";

export async function GET(request: NextRequest) {
  if (!isLinksAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}
