const PAGE_LIMIT = 50;
const OPERATIONS = Object.freeze({
  "products.list": Object.freeze({ collection: "products", fields: ["title", "category", "finalPriceStr", "location", "sellerUid"] }),
  "users.list": Object.freeze({ collection: "users", fields: ["displayName", "status"] }),
  "stores.list": Object.freeze({ collection: "stores", fields: ["shopName", "ownerName", "address", "categories", "createdAt"] })
});

function validPageSize(value) {
  return Number.isInteger(value) && value >= 1 && value <= PAGE_LIMIT;
}

function parseCursor(position) {
  if (!position || typeof position !== "object" || Array.isArray(position)) {
    throw new TypeError("Invalid cursor position.");
  }
  const keys = Object.keys(position).sort();
  if (keys.join(",") !== "createdAt,documentId") throw new TypeError("Invalid cursor position.");
  const timestamp = position.createdAt;
  if (!timestamp || typeof timestamp !== "object" || Array.isArray(timestamp) ||
      Object.keys(timestamp).sort().join(",") !== "nanoseconds,seconds" ||
      !Number.isInteger(timestamp.seconds) || timestamp.seconds < -62135596800 || timestamp.seconds > 253402300799 ||
      !Number.isInteger(timestamp.nanoseconds) || timestamp.nanoseconds < 0 || timestamp.nanoseconds >= 1e9 ||
      typeof position.documentId !== "string" || position.documentId.length < 1 || position.documentId.length > 1500 ||
      position.documentId.includes("/")) {
    throw new TypeError("Invalid cursor position.");
  }
  return { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds, documentId: position.documentId };
}

function timestampParts(value) {
  if (!value || !Number.isInteger(value.seconds) || value.seconds < -62135596800 || value.seconds > 253402300799 || !Number.isInteger(value.nanoseconds) ||
      value.nanoseconds < 0 || value.nanoseconds >= 1e9) {
    throw new TypeError("Document has invalid createdAt timestamp.");
  }
  return { seconds: value.seconds, nanoseconds: value.nanoseconds };
}

/**
 * Executes a fixed, least-privilege Admin list query using an injected Firestore
 * Admin instance. This module never initializes Firebase or accepts caller paths.
 */
export async function executeAdminReadPage({
  firestore, operation, pageSize = 25, cursorPosition = null,
  queryText = "", filters = {}, Timestamp, documentIdField, enabledOperations = []
} = {}) {
  if (!Array.isArray(enabledOperations) || enabledOperations.some(value => typeof value !== "string" || !Object.hasOwn(OPERATIONS, value))) {
    throw new TypeError("Invalid Admin read readiness allowlist.");
  }
  const definition = OPERATIONS[operation];
  if (!definition) throw new TypeError("Unsupported Admin read operation.");
  if (!enabledOperations.includes(operation)) {
    throw new TypeError("Admin read operation is not enabled.");
  }
  if (!firestore || typeof firestore.collection !== "function" ||
      typeof Timestamp !== "function" || !documentIdField) {
    throw new TypeError("Firestore adapter dependencies are incomplete.");
  }
  if (!validPageSize(pageSize)) throw new TypeError("Invalid page size.");
  if (typeof queryText !== "string" || queryText.trim().length > 0) {
    throw new TypeError("Search is not supported by this read adapter.");
  }
  if (!filters || typeof filters !== "object" || Array.isArray(filters) ||
      Object.keys(filters).length !== 0) {
    throw new TypeError("Filters are not supported by this read adapter.");
  }

  const cursor = cursorPosition === null ? null : parseCursor(cursorPosition);
  let query = firestore.collection(definition.collection)
    .select(...definition.fields, "createdAt")
    .orderBy("createdAt", "desc")
    .orderBy(documentIdField, "desc");

  if (cursor !== null) {
    const timestamp = new Timestamp(cursor.seconds, cursor.nanoseconds);
    query = query.startAfter(timestamp, cursor.documentId);
  }

  const snapshot = await query.limit(pageSize + 1).get();
  if (!snapshot || !Array.isArray(snapshot.docs) || snapshot.docs.length > pageSize + 1) {
    throw new TypeError("Invalid Firestore page snapshot.");
  }
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = docs.slice(0, pageSize);
  const items = pageDocs.map(doc => {
    if (!doc || typeof doc.id !== "string" || !doc.id || typeof doc.data !== "function") {
      throw new TypeError("Invalid Firestore document snapshot.");
    }
    const raw = doc.data();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new TypeError("Invalid Firestore document data.");
    }
    // Every visible row must have a valid cursor field, not only the final row.
    timestampParts(raw.createdAt);
    const item = { id: doc.id };
    for (const field of definition.fields) {
      if (Object.hasOwn(raw, field)) item[field] = raw[field];
    }
    return item;
  });

  let nextPosition = null;
  if (hasMore && pageDocs.length > 0) {
    const last = pageDocs[pageDocs.length - 1];
    const raw = last.data();
    nextPosition = {
      createdAt: timestampParts(raw.createdAt),
      documentId: last.id
    };
  }
  return { items, nextPosition };
}

export const ADMIN_READ_OPERATIONS = Object.freeze(Object.keys(OPERATIONS));
