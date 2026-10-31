import { executeAdminReadPage } from "./admin-read-adapter.mjs";

/**
 * Bridges the HTTP handler's normalized list contract to the fixed Firestore
 * read adapter. Search and filters are forwarded explicitly; the adapter
 * rejects them until a reviewed indexed implementation exists.
 */
export function createAdminReadExecutor({ firestore, Timestamp, documentIdField } = {}) {
  if (!firestore || typeof firestore.collection !== "function" ||
      typeof Timestamp !== "function" || !documentIdField) {
    throw new TypeError("Admin read executor dependencies are incomplete.");
  }

  return async function executeOperation({ operation, query = {}, cursorPosition = null } = {}) {
    return executeAdminReadPage({
      firestore,
      Timestamp,
      documentIdField,
      operation,
      pageSize: query.pageSize,
      cursorPosition,
      queryText: query.q ?? "",
      filters: query.filters ?? {}
    });
  };
}
