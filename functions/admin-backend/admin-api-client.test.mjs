import test from "node:test";
import assert from "node:assert/strict";
import { AdminApiError, createAdminApiClient } from "./admin-api-client.mjs";

const ok = data => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) });

test("uses fixed same-origin route, bearer token, and no-store request", async () => {
  let call;
  const client = createAdminApiClient({
    getIdToken: async () => "fresh-firebase-token",
    fetchImpl: async (...args) => { call = args; return ok({ items: [], nextPageToken: null }); }
  });
  const data = await client.request("products.list", { pageSize: 25, q: "bike" });
  assert.deepEqual(data, { items: [], nextPageToken: null });
  assert.equal(call[0], "/api/admin/products?pageSize=25&q=bike");
  assert.equal(call[1].headers.Authorization, "Bearer fresh-firebase-token");
  assert.equal(call[1].cache, "no-store");
  assert.equal(call[1].credentials, "same-origin");
});

test("missing token fails before network access", async () => {
  let called = false;
  const client = createAdminApiClient({
    getIdToken: async () => null,
    fetchImpl: async () => { called = true; return ok({}); }
  });
  await assert.rejects(client.request("users.list"), e => e instanceof AdminApiError && e.code === "AUTH_REQUIRED");
  assert.equal(called, false);
});

test("unknown operation cannot select arbitrary route", async () => {
  let called = false;
  const client = createAdminApiClient({ getIdToken: async () => "token", fetchImpl: async () => { called = true; return ok({}); } });
  await assert.rejects(client.request("../../users"), e => e.code === "UNSUPPORTED_OPERATION");
  assert.equal(called, false);
});

test("query rejects arbitrary path and object injection", async () => {
  const client = createAdminApiClient({ getIdToken: async () => "token", fetchImpl: async () => ok({}) });
  await assert.rejects(client.request("users.list", { collection: "users" }), e => e.code === "UNSUPPORTED_QUERY_PARAMETER");
  await assert.rejects(client.request("users.list", { q: { toString: () => "secret" } }), e => e.code === "INVALID_QUERY");
});

test("network failure is normalized and does not trigger a fallback", async () => {
  let calls = 0;
  const client = createAdminApiClient({ getIdToken: async () => "token", fetchImpl: async () => { calls++; throw new Error("offline"); } });
  await assert.rejects(client.request("users.list"), e => e.code === "NETWORK_ERROR");
  assert.equal(calls, 1);
});

test("server errors expose only a safe code", async () => {
  const client = createAdminApiClient({
    getIdToken: async () => "token",
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "private path" } }) })
  });
  await assert.rejects(client.request("users.list"), e => e.code === "SERVICE_UNAVAILABLE" && !e.message.includes("private path"));
});

test("malformed server response is rejected", async () => {
  const client = createAdminApiClient({ getIdToken: async () => "token", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }) });
  await assert.rejects(client.request("users.list"), e => e.code === "INVALID_SERVER_RESPONSE");
});

test("base path cannot be overridden", () => {
  assert.throws(() => createAdminApiClient({ getIdToken: async () => "token", fetchImpl: async () => ok({}), basePath: "https://other.example" }));
});
