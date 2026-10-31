import test from "node:test";
import assert from "node:assert/strict";
import { validateBackendConfig } from "./config-guard.mjs";
import { authorizeAdminRequest } from "./authz.mjs";

test("staging configuration is accepted and normalized", () => {
  const result = validateBackendConfig({ OLDX_BACKEND_ENV: "staging", OLDX_FIREBASE_PROJECT_ID: "oldx-staging" });
  assert.deepEqual(result, { environment: "staging", projectId: "oldx-staging" });
  assert.equal(Object.isFrozen(result), true);
});

test("missing configuration fails closed", () => {
  assert.throws(() => validateBackendConfig({}), /Missing required/);
});

test("production environment and production Firebase project are rejected", () => {
  assert.throws(() => validateBackendConfig({ OLDX_BACKEND_ENV: "production", OLDX_FIREBASE_PROJECT_ID: "oldx-1c983" }), /only in staging/);
  assert.throws(() => validateBackendConfig({ OLDX_BACKEND_ENV: "staging", OLDX_FIREBASE_PROJECT_ID: "oldx-1c983" }), /not the approved staging/);
});

test("authorization rejects missing and malformed bearer token", async () => {
  const deps = { verifyIdToken: async () => ({ uid: "admin-a" }), resolveActiveRole: async () => "admin", requiredOperation: "users.list", allowedOperations: ["users.list"] };
  assert.equal((await authorizeAdminRequest({ ...deps, authorization: undefined })).status, 401);
  assert.equal((await authorizeAdminRequest({ ...deps, authorization: "Basic token" })).status, 401);
  assert.equal((await authorizeAdminRequest({ ...deps, authorization: "Bearer " })).status, 401);
});

test("invalid or expired token is denied", async () => {
  const result = await authorizeAdminRequest({ authorization: "Bearer synthetic", verifyIdToken: async () => { throw new Error("expired"); }, resolveActiveRole: async () => "admin", requiredOperation: "users.list", allowedOperations: ["users.list"] });
  assert.deepEqual(result, { ok: false, status: 401, code: "INVALID_TOKEN" });
});

test("ordinary user and revoked Admin are denied", async () => {
  for (const role of ["user", null]) {
    const result = await authorizeAdminRequest({ authorization: "Bearer synthetic", verifyIdToken: async () => ({ uid: "user-a" }), resolveActiveRole: async () => role, requiredOperation: "users.list", allowedOperations: ["users.list"] });
    assert.equal(result.status, 403);
  }
});

test("active Admin may invoke only an allowlisted operation", async () => {
  const deps = { authorization: "Bearer synthetic", verifyIdToken: async () => ({ uid: "admin-a", role: "user" }), resolveActiveRole: async () => "admin", requiredOperation: "users.list", allowedOperations: ["users.list"] };
  assert.deepEqual(await authorizeAdminRequest(deps), { ok: true, identity: { uid: "admin-a" }, role: "admin" });
  assert.equal((await authorizeAdminRequest({ ...deps, requiredOperation: "roles.grant" })).status, 403);
});

test("client-claimed role and UID do not override verified identity", async () => {
  let resolvedUid;
  const result = await authorizeAdminRequest({
    authorization: "Bearer synthetic",
    verifyIdToken: async () => ({ uid: "user-a" }),
    resolveActiveRole: async (uid) => { resolvedUid = uid; return "user"; },
    requiredOperation: "users.list",
    allowedOperations: ["users.list"],
    body: { uid: "admin-a", actorUid: "admin-a", role: "admin", isAdmin: true }
  });
  assert.equal(resolvedUid, "user-a");
  assert.equal(result.status, 403);
});

test("missing verifier or role resolver fails closed", async () => {
  const result = await authorizeAdminRequest({ authorization: "Bearer synthetic", requiredOperation: "users.list", allowedOperations: ["users.list"] });
  assert.equal(result.status, 503);
});

test("role lookup errors fail closed", async () => {
  const result = await authorizeAdminRequest({ authorization: "Bearer synthetic", verifyIdToken: async () => ({ uid: "admin-a" }), resolveActiveRole: async () => { throw new Error("db"); }, requiredOperation: "users.list", allowedOperations: ["users.list"] });
  assert.equal(result.status, 503);
});


test("invalid token never reaches active-role resolver", async () => {
  let roleLookupCalled = false;
  const result = await authorizeAdminRequest({
    authorization: "Bearer invalid",
    verifyIdToken: async () => { throw new Error("invalid token"); },
    resolveActiveRole: async () => { roleLookupCalled = true; return "admin"; },
    requiredOperation: "users.list",
    allowedOperations: ["users.list"]
  });
  assert.equal(result.status, 401);
  assert.equal(roleLookupCalled, false);
});

test("role is resolved from verified UID on every request", async () => {
  let activeRole = "admin";
  let verificationCount = 0;
  let roleLookupCount = 0;
  const deps = {
    authorization: "Bearer synthetic",
    verifyIdToken: async () => { verificationCount += 1; return { uid: "admin-a", role: "admin" }; },
    resolveActiveRole: async uid => { roleLookupCount += 1; assert.equal(uid, "admin-a"); return activeRole; },
    requiredOperation: "users.list",
    allowedOperations: ["users.list"]
  };
  assert.equal((await authorizeAdminRequest(deps)).ok, true);
  activeRole = null; // simulate owner-side revocation between requests
  assert.equal((await authorizeAdminRequest(deps)).status, 403);
  assert.equal(verificationCount, 2);
  assert.equal(roleLookupCount, 2);
});

test("malformed verified identity never reaches role resolver", async () => {
  let roleLookupCalled = false;
  const result = await authorizeAdminRequest({
    authorization: "Bearer synthetic",
    verifyIdToken: async () => ({ uid: "" }),
    resolveActiveRole: async () => { roleLookupCalled = true; return "admin"; },
    requiredOperation: "users.list",
    allowedOperations: ["users.list"]
  });
  assert.equal(result.status, 401);
  assert.equal(roleLookupCalled, false);
});
