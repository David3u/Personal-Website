#!/usr/bin/env node
import http from "node:http";
import next from "next";
import { createTunnelReceiver } from "./tools/3utunnel/server.mjs";

function readOption(args, ...names) {
  for (let index = 0; index < args.length; index += 1) {
    if (names.includes(args[index])) {
      return args[index + 1];
    }
  }
  return undefined;
}

const args = process.argv.slice(2);
const mode = args.shift() || "start";
if (mode !== "dev" && mode !== "start") {
  throw new Error("Usage: node server.mjs <dev|start> [--port <port>]");
}

const dev = mode === "dev";
const port = Number(readOption(args, "--port", "-p") || process.env.PORT || 3000);
const hostname = readOption(args, "--hostname", "-H") || process.env.HOST || "0.0.0.0";

const server = http.createServer();
const app = next({
  dev,
  hostname,
  port,
  turbo: dev,
});

await app.prepare();

const handleNextRequest = app.getRequestHandler();
const handleNextUpgrade = app.getUpgradeHandler();
const publicBaseUrl = (process.env.TUNNEL_PUBLIC_BASE_URL || "https://david3u.com").replace(/\/+$/, "");
const tunnelReceiver = createTunnelReceiver({ publicBaseUrl });

server.on("request", (request, response) => {
  if (tunnelReceiver.handleRequest(request, response)) {
    return;
  }
  void handleNextRequest(request, response);
});

server.on("upgrade", (request, socket, head) => {
  if (tunnelReceiver.handleUpgrade(request, socket, head)) {
    return;
  }
  void handleNextUpgrade(request, socket, head);
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
  console.log(`> 3utunnel receiver: ${publicBaseUrl}/t/:slug`);
});
