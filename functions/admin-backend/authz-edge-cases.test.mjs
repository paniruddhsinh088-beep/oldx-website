import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAdminRequest } from "./authz.mjs";

const base = {
  authorization: "Bearer synthetic-admin-token",
  verifyIdToken: async () => ({ uid: "synthetic-admin" }),
  resolveActiveRole: async () => "admin",
  requiredOperation: "users.list",
  allowedOperations: ["users.list"]
};

const expectDenied = async (changes, status, code) => {
  const result = await authorizeAdminRequest({ ...base, ...changes });
  assert.deepEqual(result, { ok: false, status, code });
};

test("missing, malformed and empty authorization fail closed", async () => {
  for (const authorization of [undefined, null, "", "Basic token", "Bearer ", "bearer token"]) {
    await expectDenied({ authorization }, 401, "UNAUTHENTICATED");
  }
});

test("missing trusted token verifier or role resolver fails closed", async () => {
  await expectDenied({ verifyIdToken: undefined }, 503, "AUTHORIZATION_NOT_CONFIGURED");
  await expectDenied({ resolveActiveRole: undefined }, 503, "AUTHORIZATION_NOT_CONFIGURED");
});

test("token verification failures and invalid identities are denied", async () => {
  await expectDenied({ verifyIdToken: async () => { throw new Error("synthetic failure"); } }, 401, "INVALID_TOKEN");
  for (const identity of [null, {}, { uid: "" }, { uid: "   " }, { uid: "\\t" }, { uid: 123 }]) {
    await expectDenied({ verifyIdToken: async () => identity }, 401, "INVALID_TOKEN");
  }
});

test("role lookup failure and non-admin roles are denied", async () => {
  await expectDenied({ resolveActiveRole: async () => { throw new Error("synthetic failure"); } }, 503, "ROLE_LOOKUP_FAILED");
  for (const role of [null, "user", "owner", "ADMIN", { role: "admin" }]) {
    await expectDenied({ resolveActiveRole: async () => role }, 403, "FORBIDDEN");
  }
});

test("unknown and missing operation allowlists deny even verified admins", async () => {
  await expectDenied({ allowedOperations: undefined }, 403, "OPERATION_NOT_ALLOWED");
  await expectDenied({ allowedOperations: [] }, 403, "OPERATION_NOT_ALLOWED");
  await expectDenied({ requiredOperation: "roles.grant" }, 403, "OPERATION_NOT_ALLOWED");
});

test("successful authorization returns only server-verified identity and role", async () => {
  assert.deepEqual(await authorizeAdminRequest(base), {
    ok: true, identity: { uid: "synthetic-admin" }, role: "admin"
  });
});
