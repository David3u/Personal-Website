#!/usr/bin/env node
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import {
  DEFAULT_ACCESS_TTL_MS,
  DEFAULT_REFRESH_TTL_MS,
  DEFAULT_SERVER_PORT,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  createToken,
  filterHeaders,
  getRequiredSecret,
  jsonResponse,
  normalizeSlug,
  parseFrame,
  readJsonBody,
  sendFrame,
  verifyAdminPassword,
  verifyToken,
} from "./shared.mjs";

function defaultPublicBaseUrl(port) {
  return (process.env.TUNNEL_PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, "");
}

export function createTunnelReceiver({ publicBaseUrl }) {
  const tokenSecret = getRequiredSecret("TUNNEL_SESSION_SECRET", "LINKS_SESSION_SECRET");
  const trustProxy = process.env.TUNNEL_TRUST_PROXY === "1";
  const tunnels = new Map();
  const pendingRequests = new Map();
  const loginAttempts = new Map();
  const refreshSessions = new Map();

  const LOGIN_WINDOW_MS = 15 * 60 * 1000;
  const LOGIN_MAX_FAILURES = 5;

function log(message, meta = {}) {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[3utunnel] ${message}${suffix}`);
}

function issueTokenPair() {
  const clientId = crypto.randomUUID();
  const refreshId = crypto.randomUUID();
  refreshSessions.set(clientId, {
    refreshId,
    expiresAt: Date.now() + DEFAULT_REFRESH_TTL_MS,
  });

  return {
    accessToken: createToken({ type: "access", clientId }, tokenSecret, DEFAULT_ACCESS_TTL_MS),
    refreshToken: createToken({ type: "refresh", clientId, refreshId }, tokenSecret, DEFAULT_REFRESH_TTL_MS),
    expiresInSeconds: Math.floor(DEFAULT_ACCESS_TTL_MS / 1000),
  };
}

function rotateRefreshSession(payload) {
  const session = refreshSessions.get(payload.clientId);
  if (!session || session.refreshId !== payload.refreshId || session.expiresAt < Date.now()) {
    refreshSessions.delete(payload.clientId);
    return null;
  }

  const refreshId = crypto.randomUUID();
  refreshSessions.set(payload.clientId, {
    refreshId,
    expiresAt: Date.now() + DEFAULT_REFRESH_TTL_MS,
  });

  return {
    accessToken: createToken({ type: "access", clientId: payload.clientId }, tokenSecret, DEFAULT_ACCESS_TTL_MS),
    refreshToken: createToken(
      { type: "refresh", clientId: payload.clientId, refreshId },
      tokenSecret,
      DEFAULT_REFRESH_TTL_MS,
    ),
    expiresInSeconds: Math.floor(DEFAULT_ACCESS_TTL_MS / 1000),
  };
}

function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (trustProxy && typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function getLoginAttempt(request) {
  const ip = getClientIp(request);
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    const freshAttempt = { failures: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, freshAttempt);
    return { ip, attempt: freshAttempt };
  }
  return { ip, attempt };
}

function recordLoginFailure(ip, attempt) {
  attempt.failures += 1;
  loginAttempts.set(ip, attempt);
}

async function handleLogin(request, response) {
  const { ip, attempt } = getLoginAttempt(request);
  if (attempt.failures >= LOGIN_MAX_FAILURES) {
    const retryAfterSeconds = Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1000));
    response.setHeader("Retry-After", String(retryAfterSeconds));
    jsonResponse(response, 429, {
      error: "Too many failed login attempts. Try again later.",
      retryAfterSeconds,
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    jsonResponse(response, 400, { error: error.message });
    return;
  }
  if (!verifyAdminPassword(body.password)) {
    recordLoginFailure(ip, attempt);
    log("auth failure", { reason: "invalid password" });
    jsonResponse(response, 401, { error: "Invalid password." });
    return;
  }
  loginAttempts.delete(ip);
  jsonResponse(response, 200, issueTokenPair());
}

async function handleRefresh(request, response) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    jsonResponse(response, 400, { error: error.message });
    return;
  }
  const payload = verifyToken(body.refreshToken, tokenSecret, "refresh");
  const tokens = payload ? rotateRefreshSession(payload) : null;
  if (!tokens) {
    jsonResponse(response, 401, { error: "Invalid refresh token." });
    return;
  }
  jsonResponse(response, 200, tokens);
}

async function handleLogout(request, response) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    jsonResponse(response, 400, { error: error.message });
    return;
  }
  const payload = verifyToken(body.refreshToken, tokenSecret, "refresh");
  if (payload?.clientId) {
    refreshSessions.delete(payload.clientId);
  }
  jsonResponse(response, 200, { ok: true });
}

function sendNotFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Tunnel not found.\n");
}

function handleTunnelRequest(request, response, slug, targetPath) {
  const tunnel = tunnels.get(slug);
  if (!tunnel || tunnel.socket.readyState !== tunnel.socket.OPEN) {
    sendNotFound(response);
    return;
  }

  const requestId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    const pending = pendingRequests.get(requestId);
    if (!pending) {
      return;
    }
    pendingRequests.delete(requestId);
    response.writeHead(504, { "content-type": "text/plain; charset=utf-8" });
    response.end("Tunnel request timed out.\n");
    sendFrame(tunnel.socket, { type: "request-cancel", requestId });
  }, REQUEST_TIMEOUT_MS);

  pendingRequests.set(requestId, {
    tunnel,
    response,
    timeout,
    headersSent: false,
  });

  const fail = (message = "Tunnel disconnected.\n") => {
    const pending = pendingRequests.get(requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    pendingRequests.delete(requestId);
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end(message);
  };

  const forwardedProto =
    request.headers["x-forwarded-proto"] ||
    (publicBaseUrl.startsWith("https:") ? "https" : request.socket.encrypted ? "https" : "http");
  if (!sendFrame(tunnel.socket, {
      type: "request-open",
      requestId,
      method: request.method,
      path: targetPath,
      headers: filterHeaders(request.headers, {
        "x-forwarded-host": request.headers.host,
        "x-forwarded-proto": forwardedProto,
      }),
  })) {
    fail();
    return;
  }

  request.on("data", (chunk) => {
    if (!pendingRequests.has(requestId)) {
      return;
    }
    if (!sendFrame(tunnel.socket, {
      type: "request-data",
      requestId,
      data: chunk.toString("base64"),
    })) {
      fail();
    }
  });
  request.on("end", () => {
    if (pendingRequests.has(requestId) && !sendFrame(tunnel.socket, { type: "request-end", requestId })) {
      fail();
    }
  });
  request.on("aborted", () => {
    if (pendingRequests.has(requestId)) {
      sendFrame(tunnel.socket, { type: "request-cancel", requestId });
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
    }
  });
  request.on("error", () => {
    if (pendingRequests.has(requestId)) {
      sendFrame(tunnel.socket, { type: "request-cancel", requestId });
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
    }
  });
}

function handleApi(request, response, url) {
  if (request.method === "POST" && url.pathname === "/_3utunnel/login") {
    void handleLogin(request, response);
    return true;
  }
  if (request.method === "POST" && url.pathname === "/_3utunnel/refresh") {
    void handleRefresh(request, response);
    return true;
  }
  if (request.method === "POST" && url.pathname === "/_3utunnel/logout") {
    void handleLogout(request, response);
    return true;
  }
  if (request.method === "GET" && url.pathname === "/_3utunnel/health") {
    jsonResponse(response, 200, { ok: true, activeTunnels: tunnels.size });
    return true;
  }
  return false;
}

function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", publicBaseUrl);
  if (handleApi(request, response, url)) {
    return true;
  }

  const match = /^\/t\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (!match) {
    return false;
  }

  let slug;
  try {
    slug = normalizeSlug(match[1]);
  } catch {
    sendNotFound(response);
    return true;
  }

  const targetPath = `${match[2] || "/"}${url.search}`;
  handleTunnelRequest(request, response, slug, targetPath);
  return true;
}

const wss = new WebSocketServer({ noServer: true });

function handleUpgrade(request, socket, head) {
  const url = new URL(request.url ?? "/", publicBaseUrl);
  if (url.pathname === "/_3utunnel/connect") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, url);
    });
    return true;
  }

  const match = /^\/t\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (!match) {
    return false;
  }

  let slug;
  try {
    slug = normalizeSlug(match[1]);
  } catch {
    socket.destroy();
    return true;
  }

  const tunnel = tunnels.get(slug);
  if (!tunnel || tunnel.socket.readyState !== tunnel.socket.OPEN) {
    socket.destroy();
    return true;
  }

  const requestId = crypto.randomUUID();
  const targetPath = `${match[2] || "/"}${url.search}`;
  pendingRequests.set(requestId, {
    rawSocket: socket,
    timeout: setTimeout(() => {
      pendingRequests.delete(requestId);
      socket.destroy();
    }, REQUEST_TIMEOUT_MS),
  });

  sendFrame(tunnel.socket, {
    type: "ws-open",
    requestId,
    method: request.method,
    path: targetPath,
    headers: filterHeaders(request.headers, {
      "x-forwarded-host": request.headers.host,
      "x-forwarded-proto":
        request.headers["x-forwarded-proto"] ||
        (publicBaseUrl.startsWith("https:") ? "https" : request.socket.encrypted ? "https" : "http"),
    }),
    head: Buffer.from(head).toString("base64"),
  });
  return true;
}

wss.on("connection", (socket, request, url) => {
  const token = url.searchParams.get("token") || "";
  const slugParam = url.searchParams.get("slug") || "";
  const payload = verifyToken(token, tokenSecret, "access");
  if (!payload) {
    log("auth failure", { reason: "invalid access token" });
    socket.close(1008, "Unauthorized");
    return;
  }

  let slug;
  try {
    slug = normalizeSlug(slugParam);
  } catch (error) {
    socket.close(1008, error.message);
    return;
  }

  const existing = tunnels.get(slug);
  if (existing && existing.clientId !== payload.clientId) {
    log("duplicate slug rejected", { slug });
    socket.close(1008, "Slug already active");
    return;
  }
  if (existing) {
    existing.socket.close(1012, "Replaced by reconnect");
  }

  const tunnel = {
    slug,
    clientId: payload.clientId,
    socket,
    lastPongAt: Date.now(),
    wsSockets: new Map(),
  };
  tunnels.set(slug, tunnel);
  log("connected", { slug, url: `${publicBaseUrl}/t/${slug}` });
  sendFrame(socket, { type: "ready", slug, publicUrl: `${publicBaseUrl}/t/${slug}` });

  const heartbeat = setInterval(() => {
    if (Date.now() - tunnel.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
      socket.close(1011, "Heartbeat timeout");
      return;
    }
    sendFrame(socket, { type: "ping" });
  }, HEARTBEAT_INTERVAL_MS);

  socket.on("message", (raw) => {
    const frame = parseFrame(raw.toString());
    if (!frame) {
      socket.close(1002, "Unsupported protocol frame");
      return;
    }
    if (frame.type === "pong") {
      tunnel.lastPongAt = Date.now();
      return;
    }
    if (frame.type === "response-start") {
      const pending = pendingRequests.get(frame.requestId);
      if (!pending?.response) {
        return;
      }
      clearTimeout(pending.timeout);
      pending.headersSent = true;
      pending.response.writeHead(frame.statusCode || 502, filterHeaders(frame.headers));
      return;
    }
    if (frame.type === "response-data") {
      const pending = pendingRequests.get(frame.requestId);
      if (pending?.response && pending.headersSent) {
        pending.response.write(Buffer.from(frame.data || "", "base64"));
      }
      return;
    }
    if (frame.type === "response-end") {
      const pending = pendingRequests.get(frame.requestId);
      if (!pending?.response) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingRequests.delete(frame.requestId);
      pending.response.end();
      return;
    }
    if (frame.type === "response-error") {
      const pending = pendingRequests.get(frame.requestId);
      if (!pending?.response) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingRequests.delete(frame.requestId);
      if (!pending.response.headersSent) {
        pending.response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      pending.response.end(Buffer.from(frame.message || "Local request failed.\n"));
      return;
    }
    if (frame.type === "ws-accepted") {
      const pending = pendingRequests.get(frame.requestId);
      if (!pending?.rawSocket) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingRequests.delete(frame.requestId);
      const rawSocket = pending.rawSocket;
      tunnel.wsSockets.set(frame.requestId, rawSocket);
      rawSocket.write(Buffer.from(frame.responseHead || "", "base64"));
      rawSocket.on("data", (chunk) => {
        sendFrame(socket, {
          type: "ws-data",
          requestId: frame.requestId,
          data: chunk.toString("base64"),
        });
      });
      rawSocket.on("close", () => {
        tunnel.wsSockets.delete(frame.requestId);
        sendFrame(socket, { type: "ws-close", requestId: frame.requestId });
      });
      rawSocket.on("error", () => {
        tunnel.wsSockets.delete(frame.requestId);
        sendFrame(socket, { type: "ws-close", requestId: frame.requestId });
      });
      return;
    }
    if (frame.type === "ws-rejected") {
      const pending = pendingRequests.get(frame.requestId);
      if (!pending?.rawSocket) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingRequests.delete(frame.requestId);
      pending.rawSocket.end(Buffer.from(frame.responseHead || "", "base64"));
      return;
    }
    if (frame.type === "ws-data") {
      tunnel.wsSockets.get(frame.requestId)?.write(Buffer.from(frame.data || "", "base64"));
      return;
    }
    if (frame.type === "ws-close") {
      tunnel.wsSockets.get(frame.requestId)?.destroy();
      tunnel.wsSockets.delete(frame.requestId);
    }
  });

  socket.on("close", () => {
    clearInterval(heartbeat);
    if (tunnels.get(slug)?.socket === socket) {
      tunnels.delete(slug);
    }
    for (const rawSocket of tunnel.wsSockets.values()) {
      rawSocket.destroy();
    }
    for (const [requestId, pending] of pendingRequests) {
      if (pending.tunnel !== tunnel) {
        continue;
      }
      clearTimeout(pending.timeout);
      pendingRequests.delete(requestId);
      if (pending.response) {
        if (!pending.response.headersSent) {
          pending.response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        }
        pending.response.end("Tunnel disconnected.\n");
      } else {
        pending.rawSocket?.destroy();
      }
    }
    log("disconnected", { slug });
  });
});

  return {
    handleRequest,
    handleUpgrade,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.TUNNEL_PORT || process.env.PORT || DEFAULT_SERVER_PORT);
  const publicBaseUrl = defaultPublicBaseUrl(port);
  const receiver = createTunnelReceiver({ publicBaseUrl });
  const server = http.createServer((request, response) => {
    if (!receiver.handleRequest(request, response)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Tunnel not found.\n");
    }
  });

  server.on("upgrade", (request, socket, head) => {
    if (!receiver.handleUpgrade(request, socket, head)) {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`[3utunnel] server listening on ${port} ${JSON.stringify({ publicBaseUrl })}`);
  });
}
