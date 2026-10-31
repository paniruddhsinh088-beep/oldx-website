import test from "node:test";
import assert from "node:assert/strict";
import { createAdminPageToken, verifyAdminPageToken } from "./page-token.mjs";

const secret = "synthetic-test-secret-with-at-least-32-bytes";
const context = {
  actorUid: "admin-test-uid",
  operation: "products.list",
  query: "cycle",
  filters: { status: "active" },
  order: "createdAt_desc"
};

test("signed cursor round-trips for the same actor and query scope", () => {
  const token = createAdminPageToken({
    position: { createdAt: 1700000000, documentId: "product_123" },
    context,
    secret,
    now: 1_700_000_000_000
  });
  const result = verifyAdminPageToken({ token, context, secret, now: 1_700_000_010_000 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.position, { createdAt: 1700000000, documentId: "product_123" });
});

test("rejects tampered tokens and tokens signed with another secret", () => {
  const token = createAdminPageToken({ position: "doc_1", context, secret });
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(verifyAdminPageToken({ token: tampered, context, secret }).ok, false);
  assert.equal(verifyAdminPageToken({ token, context, secret: "different-secret-also-at-least-32-bytes" }).ok, false);
});

test("rejects cross-actor, cross-operation, and cross-filter replay", () => {
  const token = createAdminPageToken({ position: "doc_1", context, secret });
  assert.equal(verifyAdminPageToken({ token, context: { ...context, actorUid: "other-admin" }, secret }).code, "PAGE_TOKEN_SCOPE_MISMATCH");
  assert.equal(verifyAdminPageToken({ token, context: { ...context, operation: "users.list" }, secret }).code, "PAGE_TOKEN_SCOPE_MISMATCH");
  assert.equal(verifyAdminPageToken({ token, context: { ...context, filters: { status: "suspended" } }, secret }).code, "PAGE_TOKEN_SCOPE_MISMATCH");
});

test("rejects expired, malformed, and oversized tokens", () => {
  const token = createAdminPageToken({ position: "doc_1", context, secret, now: 1_700_000_000_000, ttlSeconds: 30 });
  assert.equal(verifyAdminPageToken({ token, context, secret, now: 1_700_000_031_000 }).code, "EXPIRED_OR_INVALID_PAGE_TOKEN");
  assert.equal(verifyAdminPageToken({ token: "not-a-token", context, secret }).ok, false);
  assert.equal(verifyAdminPageToken({ token: "x".repeat(513), context, secret }).ok, false);
});

test("requires a strong signing secret and valid TTL", () => {
  assert.throws(() => createAdminPageToken({ position: "doc_1", context, secret: "short" }));
  assert.throws(() => createAdminPageToken({ position: "doc_1", context, secret, ttlSeconds: 7200 }));
});
