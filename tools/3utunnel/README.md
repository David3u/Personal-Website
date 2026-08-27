# 3utunnel Receiver

Server-side HTTP/WebSocket tunnel receiver embedded in the Personal-Website server.

The matching CLI is maintained separately in the private [3utunnel-cli repository](https://github.com/David3u/3utunnel-cli).

## Server

The receiver runs inside this project's Node server. It starts automatically with
`npm run dev` and `npm start`; no sidecar or proxy route is needed.

The public URL defaults to `https://david3u.com`. Set this only when running the receiver behind another origin:

```sh
TUNNEL_PUBLIC_BASE_URL=https://david3u.com
```

Optional env vars:

- `TUNNEL_SESSION_SECRET`: token-signing secret. Falls back to `LINKS_SESSION_SECRET`.
- `TUNNEL_PUBLIC_BASE_URL`: public origin used when printing tunnel URLs. Defaults to `https://david3u.com`.
- `TUNNEL_TRUST_PROXY=1`: use `X-Forwarded-For` for login throttling. Only enable behind a proxy that strips client-supplied forwarding headers.

The same Next server handles `/_3utunnel/*` and `/t/*`; all other requests go to the personal website. Auth uses `LINKS_ADMIN_PASSWORD` plus signed access/refresh tokens.

The production host must run `npm start` on a persistent Node process with WebSocket support. A serverless Next host cannot run this tunnel because clients keep a long-lived WebSocket connection open.

Deploy this project with:

```sh
npm ci
npm run build
npm start
```

Cloudflare may proxy the domain, but it must allow WebSocket upgrades for both `/_3utunnel/connect` and `/t/*`.

HTTP request and response bodies stream through the tunnel as they arrive; there is no tunnel body-size cap. WebSocket traffic is forwarded as raw bytes after the HTTP upgrade handshake.

## CLI

Install or develop the client from the [3utunnel-cli repository](https://github.com/David3u/3utunnel-cli).

Example usage:

```sh
3utunnel login --host https://david3u.com
3utunnel 3000 --slug demo --host https://david3u.com
```
