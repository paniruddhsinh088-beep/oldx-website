import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAdminRequest } from "./authz.mjs";

const base = {
  authorization: "Bearer synthetic-token",
  verifyIdToken: async () => ({ uid: "verified-admin" }),
  resolveActiveRole: async () => "admin"
};

test("missing and blank operation names are denied even when allowlist contains them", async () => {
  for (const requiredOperation of [undefined, null, "", " ", 42]) {
    const result = await authorizeAdminRequest({
      ...base,
      requiredOperation,
      allowedOperations: [requiredOperation, "users.list"]
    });
    assert.deepEqual(result, { ok: false, status: 403, code: "OPERATION_NOT_ALLOWED" });
  }
});

test("a valid explicitly allowlisted operation still succeeds", async () => {
  const result = await authorizeAdminRequest({
    ...base,
    requiredOperation: "users.list",
    allowedOperations: ["users.list"]
  });
  assert.deepEqual(result, {
    ok: true,
    identity: { uid: "verified-admin" },
    role: "admin"
  });
});
