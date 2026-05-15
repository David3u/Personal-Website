import crypto from "node:crypto";
import { NextRequest } from "next/server";

export const LINKS_SESSION_COOKIE = "links_admin_session";
const LINKS_ADMIN_ROLE = "links-admin";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LINKS_SESSION_SECRET_ENV = "LINKS_SESSION_SECRET";
const LINKS_ADMIN_PASSWORD_ENV = "LINKS_ADMIN_PASSWORD";

interface SessionPayload {
  role: string;
  exp: number;
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + "=".repeat(padLength), "base64").toString("utf8");
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getConfiguredAdminPassword() {
  return getOptionalEnv(LINKS_ADMIN_PASSWORD_ENV);
}

export function hasConfiguredAdminPassword() {
  return getConfiguredAdminPassword() !== null;
}

function getSessionSecret() {
  return getOptionalEnv(LINKS_SESSION_SECRET_ENV);
}

function sign(value: string, secret: string) {
  return base64Url(crypto.createHmac("sha256", secret).update(value).digest());
}

function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

export function verifyAdminPassword(password: string) {
  const configuredPassword = getConfiguredAdminPassword();
  if (!configuredPassword) {
    return false;
  }

  return crypto.timingSafeEqual(hashSecret(password), hashSecret(configuredPassword));
}

export function createSessionToken() {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    throw new Error("Links admin auth is not configured.");
  }

  const payload: SessionPayload = {
    role: LINKS_ADMIN_ROLE,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, sessionSecret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, sessionSecret);
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!matches) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;
    if (!parsed || parsed.role !== LINKS_ADMIN_ROLE || parsed.exp < Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(LINKS_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function isLinksAdminAuthenticated(request: NextRequest) {
  return getSessionFromRequest(request) !== null;
}
