import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminRequest } from "./http-handler.mjs";
import { createAdminReadExecutor } from "./admin-read-executor.mjs";

class Timestamp {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
}
const documentIdField = { name: "__name__" };
function fixtureFirestore() {
  const calls = [];
  const allDocs = [
    { id: "u3", value: { displayName: "Three", status: "active", createdAt: { seconds: 3, nanoseconds: 0 } } },
    { id: "u2", value: { displayName: "Two", status: "active", createdAt: { seconds: 2, nanoseconds: 0 } } },
    { id: "u1", value: { displayName: "One", status: "active", createdAt: { seconds: 1, nanoseconds: 0 } } }
  ];
  return {
    calls,
    collection(name) {
      calls.push(["collection", name]);
      let after = null;
      let limit = 0;
      const query = {
        select(...fields) { calls.push(["select", ...fields]); return this; },
        orderBy(...args) { calls.push(["orderBy", ...args]); return this; },
        startAfter(timestamp, id) { after = { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds, id }; calls.push(["startAfter", after]); return this; },
        limit(value) { limit = value; calls.push(["limit", value]); return this; },
        async get() {
          calls.push(["get"]);
          const start = after ? allDocs.findIndex(x => x.id === after.id) + 1 : 0;
          return { docs: allDocs.slice(start, start + limit).map(x => ({ id: x.id, data: () => x.value })) };
        }
      };
      return query;
    }
  };
}

test("Admin HTTP list flow signs next page and resumes with verified Firestore cursor", async () => {
  const firestore = fixtureFirestore();
  const executeOperation = createAdminReadExecutor({ firestore, Timestamp, documentIdField });
  const secret = "integration-test-secret-with-more-than-32-bytes";
  const common = {
    operation: "users.list",
    allowedOperations: ["users.list"],
    verifyIdToken: async () => ({ uid: "synthetic-admin" }),
    resolveActiveRole: async () => "admin",
    executeOperation,
    pageTokenSecret: secret
  };

  const first = await handleAdminRequest({
    ...common,
    request: { method: "GET", headers: { authorization: "Bearer synthetic" }, query: { pageSize: "2" } }
  });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.data.items.map(item => item.id), ["u3", "u2"]);
  assert.equal(typeof first.body.data.nextPageToken, "string");
  assert.equal(JSON.stringify(first.body).includes("nextPosition"), false);

  const second = await handleAdminRequest({
    ...common,
    request: {
      method: "GET",
      headers: { authorization: "Bearer synthetic" },
      query: { pageSize: "2", pageToken: first.body.data.nextPageToken }
    }
  });
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.data.items.map(item => item.id), ["u1"]);
  assert.equal(second.body.data.nextPageToken, null);
  assert.deepEqual(firestore.calls.find(call => call[0] === "startAfter"), [
    "startAfter", { seconds: 2, nanoseconds: 0, id: "u2" }
  ]);
});

test("Admin HTTP list flow rejects search and filters before any Firestore query", async () => {
  const firestore = fixtureFirestore();
  const executeOperation = createAdminReadExecutor({ firestore, Timestamp, documentIdField });
  const common = {
    operation: "users.list",
    allowedOperations: ["users.list"],
    verifyIdToken: async () => ({ uid: "synthetic-admin" }),
    resolveActiveRole: async () => "admin",
    executeOperation
  };
  const result = await handleAdminRequest({
    ...common,
    request: { method: "GET", headers: { authorization: "Bearer synthetic" }, query: { q: "private search" } }
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(firestore.calls.length, 0);
});
