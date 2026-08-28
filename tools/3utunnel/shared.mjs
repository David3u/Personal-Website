import crypto from "node:crypto";

export const PROTOCOL_VERSION = 1;
export const DEFAULT_SERVER_PORT = 4040;
export const DEFAULT_ACCESS_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 25 * 1000;
export const HEARTBEAT_TIMEOUT_MS = 75 * 1000;
export const SLUG_REGEX = /^[a-z0-9_-]{1,50}$/;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function normalizeSlug(slug) {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!SLUG_REGEX.test(normalized)) {
    throw new Error("Slug must be 1-50 chars using letters, numbers, '-' or '_'.");
  }
  return normalized;
}

export function getRequiredSecret(name, fallbackName = null) {
  const value = process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : "");
  if (!value) {
    throw new Error(`${name}${fallbackName ? ` or ${fallbackName}` : ""} is required.`);
  }
  return value;
}

export function timingSafeEqualText(left, right) {
  const leftHash = crypto.createHash("sha256").update(left).digest();
  const rightHash = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

export function verifyAdminPassword(password) {
  const configuredPassword = process.env.LINKS_ADMIN_PASSWORD?.trim();
  if (!configuredPassword) {
    return false;
  }
  return timingSafeEqualText(String(password ?? ""), configuredPassword);
}

export function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeBase64Url(input) {
  const normalized = String(input).replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + "=".repeat(padLength), "base64").toString("utf8");
}

export function signValue(value, secret) {
  return base64Url(crypto.createHmac("sha256", secret).update(value).digest());
}

export function createToken(payload, secret, ttlMs) {
  const fullPayload = {
    ...payload,
    exp: Date.now() + ttlMs,
    iat: Date.now(),
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const encodedPayload = base64Url(JSON.stringify(fullPayload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token, secret, expectedType) {
  const [encodedPayload, signature] = String(token ?? "").split(".");
  if (!encodedPayload || !signature) {
    return null;
  }
  const expectedSignature = signValue(encodedPayload, secret);
  if (signature.length !== expectedSignature.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }
  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    if (!payload || payload.type !== expectedType || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function jsonResponse(response, statusCode, body) {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": payload.length,
  });
  response.end(payload);
}

export function readJsonBody(request, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

export function filterHeaders(headers, extra = {}) {
  const nextHeaders = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    nextHeaders[lowerName] = value;
  }
  return { ...nextHeaders, ...extra };
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseFrame(value) {
  const frame = safeJsonParse(value);
  if (!frame || frame.v !== PROTOCOL_VERSION) {
    return null;
  }
  return frame;
}

export function sendFrame(socket, frame) {
  if (socket.readyState !== socket.OPEN) {
    return false;
  }
  socket.send(JSON.stringify({ v: PROTOCOL_VERSION, ...frame }));
  return true;
}

export function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
