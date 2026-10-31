import { executeAdminReadPage, ADMIN_READ_OPERATIONS } from "./admin-read-adapter.mjs";

/**
 * Bridges normalized HTTP list requests to the fixed Firestore adapter.
 * Operations are disabled unless a trusted server composition explicitly
 * enables them after collection-specific schema/index verification.
 */
export function createAdminReadExecutor({
  firestore, Timestamp, documentIdField, enabledOperations = []
} = {}) {
  if (!firestore || typeof firestore.collection !== "function" ||
      typeof Timestamp !== "function" || !documentIdField ||
      !Array.isArray(enabledOperations) ||
      enabledOperations.some(operation => typeof operation !== "string" || !ADMIN_READ_OPERATIONS.includes(operation))) {
    throw new TypeError("Admin read executor dependencies are incomplete.");
  }

  const enabled = new Set(enabledOperations);
  return async function executeOperation({ operation, query = {}, cursorPosition = null } = {}) {
    if (!enabled.has(operation)) {
      throw new TypeError("Admin read operation is not enabled pending schema readiness verification.");
    }
    return executeAdminReadPage({
      firestore,
      Timestamp,
      documentIdField,
      operation,
      pageSize: query.pageSize,
      cursorPosition,
      queryText: query.q ?? "",
      filters: query.filters ?? {},
      enabledOperations: [...enabled]
    });
  };
}
