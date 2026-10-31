import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminRequest } from "./http-handler.mjs";

const common = {
  operation: "users.list",
  allowedOperations: ["users.list", "users.suspend"],
  verifyIdToken: async token => ({ uid: token === "admin-token" ? "admin-a" : "user-a" }),
  resolveActiveRole: async uid => uid === "admin-a" ? "admin" : "user",
  executeOperation: async ({ actorUid }) => ({ actorUid, items: [] }),
  requestId: "synthetic-request-1"
};

test("GET handler returns no-store headers and server-derived actor", async () => {
  const result = await handleAdminRequest({ ...common, request: { method: "GET", headers: { authorization: "Bearer admin-token" } } });
  assert.equal(result.status, 200);
  assert.equal(result.headers["Cache-Control"], "no-store, max-age=0");
  assert.deepEqual(result.body.data, { actorUid: "admin-a", items: [] });
});

test("ordinary user receives generic forbidden response", async () => {
  const result = await handleAdminRequest({ ...common, request: { method: "GET", headers: { authorization: "Bearer user-token" } } });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.message, "Request not permitted");
});

test("method mismatch is rejected", async () => {
  const result = await handleAdminRequest({ ...common, request: { method: "DELETE", headers: { authorization: "Bearer admin-token" } } });
  assert.equal(result.status, 405);
});

test("unconfigured operation fails closed", async () => {
  const result = await handleAdminRequest({ ...common, executeOperation: undefined, request: { method: "GET", headers: { authorization: "Bearer admin-token" } } });
  assert.equal(result.status, 503);
});

test("mutation requires audit writer and does not report success without it", async () => {
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", reason: "test" } }
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "AUDIT_NOT_CONFIGURED");
});

test("mutation writes audit event using server-derived actor", async () => {
  let event;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", role: "owner" } },
    writeAuditEvent: async value => { event = value; }
  });
  assert.equal(result.status, 200);
  assert.equal(event.actorUid, "admin-a");
  assert.equal(event.actorRole, "admin");
  assert.equal(event.operation, "users.suspend");
});

test("audit write failure fails the request without leaking internals", async () => {
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" } },
    writeAuditEvent: async () => { throw new Error("private db path"); }
  });
  assert.equal(result.status, 500);
  assert.equal(JSON.stringify(result.body).includes("private db path"), false);
});

test("unknown operation is denied even for Admin", async () => {
  const result = await handleAdminRequest({
    ...common, operation: "users.dumpAll",
    request: { method: "GET", headers: { authorization: "Bearer admin-token" } }
  });
  assert.equal(result.status, 403);
});
