import test from "node:test";
import assert from "node:assert/strict";
import { executeAdminReadPage } from "./admin-read-adapter.mjs";

function makeFirestore(docs) {
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
const Timestamp = { fromMillis: value => ({ millis: value }) };
const documentIdField = { name: "__name__" };
const doc = (id, data) => ({ id, data: () => data });

test("uses only the fixed products collection and approved projection", async () => {
  const db = makeFirestore([doc("p1", {
    title: "Cycle", category: "Sports", finalPriceStr: "100",
    location: "Ahmedabad", sellerUid: "seller-1", phone: "private", userIp: "private",
    createdAt: { seconds: 100, nanoseconds: 0 }
  })]);
  const result = await executeAdminReadPage({ firestore: db, operation: "products.list", Timestamp, documentIdField });
  assert.deepEqual(db.calls.slice(0, 4), [
    ["collection", "products"],
    ["select", "title", "category", "finalPriceStr", "location", "sellerUid"],
    ["orderBy", "createdAt", "desc"],
    ["orderBy", documentIdField, "desc"]
  ]);
  assert.deepEqual(result.items[0], {
    id: "p1", title: "Cycle", category: "Sports", finalPriceStr: "100",
    location: "Ahmedabad", sellerUid: "seller-1"
  });
});

test("uses a bounded look-ahead and emits cursor from last visible item", async () => {
  const db = makeFirestore([
    doc("u2", { displayName: "Two", status: "active", createdAt: { seconds: 2, nanoseconds: 0 } }),
    doc("u1", { displayName: "One", status: "active", createdAt: { seconds: 1, nanoseconds: 5000000 } }),
    doc("u0", { displayName: "Lookahead", status: "active", createdAt: { seconds: 1, nanoseconds: 0 } })
  ]);
  const result = await executeAdminReadPage({
    firestore: db, operation: "users.list", pageSize: 2, Timestamp, documentIdField
  });
  assert.deepEqual(db.calls.find(call => call[0] === "limit"), ["limit", 3]);
  assert.deepEqual(result.items.map(x => x.id), ["u2", "u1"]);
  assert.deepEqual(result.nextPosition, {
    createdAt: { seconds: 1, nanoseconds: 5000000 }, documentId: "u1"
  });
});

test("validates cursor and applies it as timestamp plus document ID", async () => {
  const db = makeFirestore([]);
  await executeAdminReadPage({
    firestore: db, operation: "users.list", pageSize: 10,
    cursorPosition: { createdAt: { seconds: 9, nanoseconds: 123000000 }, documentId: "u9" },
    Timestamp, documentIdField
  });
  assert.deepEqual(db.calls.find(call => call[0] === "startAfter"), [
    "startAfter", { millis: 9123 }, "u9"
  ]);
});

test("rejects arbitrary operation, invalid page size, and malformed cursor before query", async () => {
  const db = makeFirestore([]);
  await assert.rejects(() => executeAdminReadPage({
    firestore: db, operation: "users.dumpAll", Timestamp, documentIdField
  }), /Unsupported/);
  await assert.rejects(() => executeAdminReadPage({
    firestore: db, operation: "users.list", pageSize: 51, Timestamp, documentIdField
  }), /page size/);
  await assert.rejects(() => executeAdminReadPage({
    firestore: db, operation: "users.list",
    cursorPosition: { collection: "users", path: "users/u1" }, Timestamp, documentIdField
  }), /cursor/);
  assert.equal(db.calls.length, 0);
});

test("does not produce a next cursor when there is no look-ahead document", async () => {
  const db = makeFirestore([doc("u1", { displayName: "One", status: "active", createdAt: { seconds: 1, nanoseconds: 0 } })]);
  const result = await executeAdminReadPage({ firestore: db, operation: "users.list", Timestamp, documentIdField });
  assert.equal(result.nextPosition, null);
});
