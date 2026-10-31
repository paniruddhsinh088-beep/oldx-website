import test from "node:test";
import assert from "node:assert/strict";
import { createAdminReadExecutor } from "./admin-read-executor.mjs";

function makeFirestore(docs = []) {
  const calls = [];
  const query = {
    select(...fields) { calls.push(["select", ...fields]); return this; },
    orderBy(...args) { calls.push(["orderBy", ...args]); return this; },
    startAfter(...args) { calls.push(["startAfter", ...args]); return this; },
    limit(value) { calls.push(["limit", value]); return this; },
    async get() { calls.push(["get"]); return { docs }; }
  };
  return { calls, collection(name) { calls.push(["collection", name]); return query; } };
}
class Timestamp { constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; } }
const documentIdField = { name: "__name__" };
const doc = (id, data) => ({ id, data: () => data });

test("bridges normalized list query and returns bounded page", async () => {
  const firestore = makeFirestore([
    doc("p1", { title: "Cycle", createdAt: { seconds: 2, nanoseconds: 0 } }),
    doc("p0", { title: "Lookahead", createdAt: { seconds: 1, nanoseconds: 0 } })
  ]);
  const execute = createAdminReadExecutor({ firestore, Timestamp, documentIdField });
  const result = await execute({
    operation: "products.list",
    query: { pageSize: 1, q: "", filters: {} }
  });
  assert.deepEqual(result.items, [{ id: "p1", title: "Cycle" }]);
  assert.deepEqual(result.nextPosition, {
    createdAt: { seconds: 2, nanoseconds: 0 }, documentId: "p1"
  });
});

test("forwards non-empty search and filters so adapter fails closed before Firestore", async () => {
  const firestore = makeFirestore();
  const execute = createAdminReadExecutor({ firestore, Timestamp, documentIdField });
  await assert.rejects(() => execute({
    operation: "products.list",
    query: { pageSize: 25, q: "bike", filters: {} }
  }), /Search is not supported/);
  await assert.rejects(() => execute({
    operation: "products.list",
    query: { pageSize: 25, q: "", filters: { status: "active" } }
  }), /Filters are not supported/);
  assert.equal(firestore.calls.length, 0);
});

test("forwards verified cursor position unchanged to adapter", async () => {
  const firestore = makeFirestore([]);
  const execute = createAdminReadExecutor({ firestore, Timestamp, documentIdField });
  await execute({
    operation: "users.list",
    query: { pageSize: 10, q: "", filters: {} },
    cursorPosition: { createdAt: { seconds: 9, nanoseconds: 123 }, documentId: "u9" }
  });
  assert.deepEqual(firestore.calls.find(call => call[0] === "startAfter"), [
    "startAfter", new Timestamp(9, 123), "u9"
  ]);
});

test("requires trusted Firestore dependencies at construction", () => {
  assert.throws(() => createAdminReadExecutor({}), /dependencies are incomplete/);
});
