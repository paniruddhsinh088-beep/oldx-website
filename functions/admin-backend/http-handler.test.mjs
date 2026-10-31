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

test("unconfigured read operation fails closed", async () => {
  const result = await handleAdminRequest({ ...common, executeOperation: undefined, request: { method: "GET", headers: { authorization: "Bearer admin-token" } } });
  assert.equal(result.status, 503);
});

test("mutation fails closed if atomic commit adapter is missing", async () => {
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", reason: "test" } }
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "ATOMIC_COMMIT_NOT_CONFIGURED");
});

test("mutation delegates one atomic commit with server-derived actor and body", async () => {
  let commit;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", role: "owner" } },
    commitMutation: async value => { commit = value; return { suspended: true }; }
  });
  assert.equal(result.status, 200);
  assert.equal(commit.actorUid, "admin-a");
  assert.equal(commit.actorRole, "admin");
  assert.equal(commit.operation, "users.suspend");
  assert.deepEqual(commit.body, { uid: "user-b", role: "owner" });
});

test("atomic commit failure returns generic error without leaking internals", async () => {
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" } },
    commitMutation: async () => { throw new Error("private db path"); }
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

test("missing request ID is generated as a UUID", async () => {
  const result = await handleAdminRequest({
    ...common, requestId: undefined,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" } }
  });
  assert.equal(result.status, 200);
  assert.match(result.body.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("blank request ID is replaced with a generated UUID", async () => {
  const result = await handleAdminRequest({
    ...common, requestId: "   ",
    request: { method: "GET", headers: { authorization: "Bearer admin-token" } }
  });
  assert.equal(result.status, 200);
  assert.match(result.body.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
