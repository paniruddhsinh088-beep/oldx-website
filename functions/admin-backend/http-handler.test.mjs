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
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", reason: "test" } },
    validateMutationInput: async ({ body }) => ({ ok: true, value: body })
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "ATOMIC_COMMIT_NOT_CONFIGURED");
});

test("mutation fails closed when operation-specific validation is not configured", async () => {
  let commitCalled = false;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "MUTATION_VALIDATION_NOT_CONFIGURED");
  assert.equal(commitCalled, false);
});

test("atomic commit receives only the validator's normalized value", async () => {
  let commit;
  const rawBody = { uid: " user-b ", reason: " reviewed ", actorRole: "owner", extra: "discard-me" };
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: rawBody },
    validateMutationInput: async ({ operation, body }) => {
      assert.equal(operation, "users.suspend");
      assert.equal(body, rawBody);
      return { ok: true, value: { uid: body.uid.trim(), reason: body.reason.trim() } };
    },
    commitMutation: async value => { commit = value; return { suspended: true }; }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(commit.body, { uid: "user-b", reason: "reviewed" });
  assert.equal(Object.hasOwn(commit.body, "actorRole"), false);
  assert.equal(Object.hasOwn(commit.body, "extra"), false);
});

test("incomplete successful validator results never reach atomic commit", async t => {
  const invalidResults = [
    null,
    true,
    { ok: true },
    Object.assign([], { ok: true, value: { uid: "user-b" } }),
    Object.assign(new Date(), { ok: true, value: { uid: "user-b" } }),
    Object.create({ value: { uid: "user-b" }, ok: true }),
    Object.defineProperty({ ok: true }, "value", { get() { throw new Error("getter must not run"); } }),
    { ok: true, value: undefined },
    { ok: true, value: "user-b" },
    { ok: true, value: ["user-b"] },
    { ok: true, value: null },
    { ok: true, value: new Date() }
  ];
  for (const invalidResult of invalidResults) {
    await t.test(String(invalidResult), async () => {
      let commitCalled = false;
      const result = await handleAdminRequest({
        ...common, operation: "users.suspend", isMutation: true,
        request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
        validateMutationInput: async () => invalidResult,
        commitMutation: async () => { commitCalled = true; return { suspended: true }; }
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.error.code, "INVALID_MUTATION_INPUT");
      assert.equal(commitCalled, false);
    });
  }
});

test("hostile validator result proxy fails closed without commit", async () => {
  let commitCalled = false;
  const hostileResult = new Proxy({}, {
    getPrototypeOf() { throw new Error("private proxy trap"); }
  });
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
    validateMutationInput: async () => hostileResult,
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(result.body).includes("private proxy trap"), false);
  assert.equal(commitCalled, false);
});

test("hostile normalized payload proxy never reaches atomic commit", async () => {
  let commitCalled = false;
  const hostilePayload = new Proxy({}, {
    getPrototypeOf() { throw new Error("private payload proxy trap"); }
  });
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
    validateMutationInput: async () => ({ ok: true, value: hostilePayload }),
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(result.body).includes("private payload proxy trap"), false);
  assert.equal(commitCalled, false);
});

test("invalid mutation input never reaches atomic commit adapter", async () => {
  let commitCalled = false;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", role: "admin" } },
    validateMutationInput: async () => ({ ok: false }),
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_MUTATION_INPUT");
  assert.equal(commitCalled, false);
});

test("mutation delegates one atomic commit with server-derived actor and body", async () => {
  let commit;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", role: "owner" } },
    validateMutationInput: async ({ body }) => ({ ok: true, value: body }),
    commitMutation: async value => { commit = value; return { suspended: true }; }
  });
  assert.equal(result.status, 200);
  assert.equal(commit.actorUid, "admin-a");
  assert.equal(commit.actorRole, "admin");
  assert.equal(commit.operation, "users.suspend");
  assert.equal(commit.requestId, "synthetic-request-1");
  assert.deepEqual(commit.body, { uid: "user-b", role: "owner" });
});

test("client-supplied audit identity and outcome fields remain nested untrusted input", async () => {
  let commit;
  const forgedBody = {
    uid: "target-user",
    actorUid: "forged-admin",
    actorRole: "owner",
    operation: "roles.grant",
    requestId: "forged-request",
    eventId: "forged-event",
    occurredAt: "2000-01-01T00:00:00.000Z",
    outcome: "success",
    auditPath: "adminAudit/forged"
  };
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: forgedBody },
    validateMutationInput: async ({ body }) => ({ ok: true, value: body }),
    commitMutation: async value => { commit = value; return { suspended: true }; }
  });
  assert.equal(result.status, 200);
  assert.equal(commit.actorUid, "admin-a");
  assert.equal(commit.actorRole, "admin");
  assert.equal(commit.operation, "users.suspend");
  assert.equal(commit.requestId, "synthetic-request-1");
  assert.deepEqual(commit.body, forgedBody);
  assert.notEqual(commit.actorUid, commit.body.actorUid);
  assert.notEqual(commit.operation, commit.body.operation);
});

test("validator exception never reaches atomic commit and returns generic error", async () => {
  let commitCalled = false;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
    validateMutationInput: async () => { throw new Error("private validator details"); },
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(result.body).includes("private validator details"), false);
  assert.equal(commitCalled, false);
});

test("atomic commit failure returns generic error without leaking internals", async () => {
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
    validateMutationInput: async ({ body }) => ({ ok: true, value: body }),
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


test("list handler passes only normalized bounded query to the operation", async () => {
  let received;
  const result = await handleAdminRequest({
    ...common,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" }, query: { pageSize: "10" } },
    executeOperation: async value => { received = value; return { items: [] }; }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(received, { actorUid: "admin-a", operation: "users.list", query: { pageSize: 10, pageToken: null, q: "", filters: {} } });
});

test("list handler rejects filters not allowed for that operation", async () => {
  const result = await handleAdminRequest({
    ...common,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" }, query: { targetType: "user" } }
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "UNSUPPORTED_QUERY_PARAMETER");
});

test("list handler rejects oversized page requests before adapter execution", async () => {
  let called = false;
  const result = await handleAdminRequest({
    ...common,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" }, query: { pageSize: "500" } },
    executeOperation: async () => { called = true; }
  });
  assert.equal(result.status, 400);
  assert.equal(called, false);
});


test("list handler verifies scoped signed cursors before adapter execution", async () => {
  const { createAdminPageToken } = await import("./page-token.mjs");
  const secret = "synthetic-handler-secret-with-32-bytes-minimum";
  const context = {
    actorUid: "admin-a", operation: "users.list", query: "",
    filters: {}, order: "createdAt_desc"
  };
  const token = createAdminPageToken({ position: { id: "user-25" }, context, secret });
  let received;
  const result = await handleAdminRequest({
    ...common, pageTokenSecret: secret,
    request: {
      method: "GET", headers: { authorization: "Bearer admin-token" },
      query: { pageToken: token }
    },
    executeOperation: async value => { received = value; return { items: [] }; }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(received.cursorPosition, { id: "user-25" });
  assert.equal(received.query.pageToken, null);
});

test("list handler rejects a cursor replayed by another Admin", async () => {
  const { createAdminPageToken } = await import("./page-token.mjs");
  const secret = "synthetic-handler-secret-with-32-bytes-minimum";
  const token = createAdminPageToken({
    position: "doc-1",
    context: { actorUid: "someone-else", operation: "users.list", query: "", filters: {}, order: "createdAt_desc" },
    secret
  });
  let called = false;
  const result = await handleAdminRequest({
    ...common, pageTokenSecret: secret,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" }, query: { pageToken: token } },
    executeOperation: async () => { called = true; return { items: [] }; }
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "PAGE_TOKEN_SCOPE_MISMATCH");
  assert.equal(called, false);
});

test("list handler signs adapter next positions and never exposes raw positions", async () => {
  const secret = "synthetic-handler-secret-with-32-bytes-minimum";
  const result = await handleAdminRequest({
    ...common, pageTokenSecret: secret,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" } },
    executeOperation: async () => ({ items: [{ id: "one" }], nextPosition: { id: "last-doc" } })
  });
  assert.equal(result.status, 200);
  assert.equal(typeof result.body.data.nextPageToken, "string");
  assert.equal(JSON.stringify(result.body).includes("last-doc"), false);
});


test("list handler rejects a signed cursor replayed with a different page size", async () => {
  const { createAdminPageToken } = await import("./page-token.mjs");
  const secret = "synthetic-handler-secret-with-32-bytes-minimum";
  const token = createAdminPageToken({
    position: "doc-10",
    context: { actorUid: "admin-a", operation: "users.list", query: "", filters: {}, order: "createdAt_desc", pageSize: 10 },
    secret
  });
  let called = false;
  const result = await handleAdminRequest({
    ...common, pageTokenSecret: secret,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" }, query: { pageSize: "25", pageToken: token } },
    executeOperation: async () => { called = true; return { items: [] }; }
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "PAGE_TOKEN_SCOPE_MISMATCH");
  assert.equal(called, false);
});


test("unauthorized mutation never invokes atomic commit adapter", async () => {
  let commitCalled = false;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer user-token" }, body: { uid: "user-b" } },
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 403);
  assert.equal(commitCalled, false);
});

test("mutation with wrong HTTP method never invokes atomic commit adapter", async () => {
  let commitCalled = false;
  const result = await handleAdminRequest({
    ...common, operation: "users.suspend", isMutation: true,
    request: { method: "GET", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b" } },
    commitMutation: async () => { commitCalled = true; return { suspended: true }; }
  });
  assert.equal(result.status, 405);
  assert.equal(commitCalled, false);
});

test("mutation operation not allowlisted never invokes atomic commit adapter", async () => {
  let commitCalled = false;
  const result = await handleAdminRequest({
    ...common, operation: "roles.grant", isMutation: true,
    request: { method: "POST", headers: { authorization: "Bearer admin-token" }, body: { uid: "user-b", role: "admin" } },
    commitMutation: async () => { commitCalled = true; return { changed: true }; }
  });
  assert.equal(result.status, 403);
  assert.equal(commitCalled, false);
});
