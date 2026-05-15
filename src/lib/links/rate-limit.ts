import { NextRequest } from "next/server";

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000;

type AttemptState = {
  failures: number;
  blockedUntil: number;
};

const attemptsByIp = new Map<string, AttemptState>();

function getIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function getState(ip: string, now: number) {
  const current = attemptsByIp.get(ip);
  if (!current) {
    const initial: AttemptState = {
      failures: 0,
      blockedUntil: 0,
    };
    attemptsByIp.set(ip, initial);
    return initial;
  }

  if (current.blockedUntil && now >= current.blockedUntil) {
    current.blockedUntil = 0;
    current.failures = 0;
  }

  return current;
}

export function checkLoginRateLimit(request: NextRequest) {
  const ip = getIpAddress(request);
  const now = Date.now();
  const state = getState(ip, now);

  if (state.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
      delaySeconds: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    delaySeconds: state.failures > 0 ? state.failures + 3 : 0,
  };
}

export function recordFailedLoginAttempt(request: NextRequest) {
  const ip = getIpAddress(request);
  const now = Date.now();
  const state = getState(ip, now);

  state.failures += 1;

  if (state.failures >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = now + BLOCK_MS;
  }

  attemptsByIp.set(ip, state);

  return {
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - state.failures),
    retryAfterSeconds: state.blockedUntil > now ? Math.ceil((state.blockedUntil - now) / 1000) : 0,
  };
}

export function clearLoginAttempts(request: NextRequest) {
  const ip = getIpAddress(request);
  attemptsByIp.delete(ip);
}
