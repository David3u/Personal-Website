import assert from "node:assert/strict";
import test from "node:test";
import {
  createDownloadAccess,
  verifyDownloadAccess,
} from "../src/lib/links/auth.ts";

test("download links are signed and expire", () => {
  process.env.LINKS_SESSION_SECRET = "test-secret";
  const now = 1_000;
  const id = "0123456789abcdef0123456789abcdef";
  const access = createDownloadAccess(id, now);

  assert.equal(
    verifyDownloadAccess(id, String(access.expires), access.signature, now),
    true,
  );
  assert.equal(
    verifyDownloadAccess("tampered", String(access.expires), access.signature, now),
    false,
  );
  assert.equal(
    verifyDownloadAccess(id, String(access.expires), access.signature, access.expires),
    false,
  );
});
