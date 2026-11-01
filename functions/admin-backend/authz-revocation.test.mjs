import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAdminRequest } from "./authz.mjs";

const allowed = {
  authorization: "Bearer synthetic-token",
  requiredOperation: "products.list",
  allowedOperations: ["products.list"]
};

test("invalid token never triggers role lookup", async () => {
  let roleCalls = 0;
  const result = await authorizeAdminRequest({
    ...allowed,
    verifyIdToken: async () => { throw new Error("invalid synthetic token"); },
    resolveActiveRole: async () => { roleCalls++; return "admin"; }
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(roleCalls, 0);
});

test("role is resolved using verified UID only", async () => {
  const seen = [];
  const result = await authorizeAdminRequest({
    ...allowed,
    verifyIdToken: async () => ({ uid: "verified-user", role: "owner", admin: true }),
    resolveActiveRole: async uid => { seen.push(uid); return "user"; }
  });
  assert.deepEqual(seen, ["verified-user"]);
  assert.deepEqual(result, { ok: false, status: 403, code: "FORBIDDEN" });
});

test("revoked Admin role denies an otherwise valid token", async () => {
  const result = await authorizeAdminRequest({
    ...allowed,
    verifyIdToken: async () => ({ uid: "former-admin" }),
    resolveActiveRole: async () => null
  });
  assert.deepEqual(result, { ok: false, status: 403, code: "FORBIDDEN" });
});

test("unlisted privileged operation is denied before granting access", async () => {
  const result = await authorizeAdminRequest({
    ...allowed,
    requiredOperation: "roles.grant",
    verifyIdToken: async () => ({ uid: "verified-admin" }),
    resolveActiveRole: async () => "admin"
  });
  assert.deepEqual(result, { ok: false, status: 403, code: "OPERATION_NOT_ALLOWED" });
});
