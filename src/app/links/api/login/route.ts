import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  hasConfiguredAdminPassword,
  LINKS_SESSION_COOKIE,
  verifyAdminPassword,
} from "@/lib/links/auth";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLoginAttempt,
} from "@/lib/links/rate-limit";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function misconfiguredResponse() {
  return NextResponse.json(
    { error: "Links admin is not configured." },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  const rateLimit = checkLoginRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many failed login attempts. Try again later.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  if (rateLimit.delaySeconds > 0) {
    await sleep(rateLimit.delaySeconds * 1000);
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!hasConfiguredAdminPassword()) {
    return misconfiguredResponse();
  }

  const validPassword = verifyAdminPassword(password);

  if (!validPassword) {
    const attempt = recordFailedLoginAttempt(request);

    const statusCode = attempt.retryAfterSeconds > 0 ? 429 : 401;
    const response = NextResponse.json(
      {
        error:
          statusCode === 429
            ? "Too many failed login attempts. Try again later."
            : "Invalid password.",
        retryAfterSeconds: attempt.retryAfterSeconds,
        remainingAttempts: attempt.remainingAttempts,
      },
      { status: statusCode },
    );

    if (attempt.retryAfterSeconds > 0) {
      response.headers.set("Retry-After", String(attempt.retryAfterSeconds));
    }

    return response;
  }

  clearLoginAttempts(request);

  let token: string;
  try {
    token = createSessionToken();
  } catch {
    return misconfiguredResponse();
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: LINKS_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/links",
    maxAge: 12 * 60 * 60,
  });

  return response;
}
