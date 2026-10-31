import { randomUUID } from "node:crypto";
import { authorizeAdminRequest } from "./authz.mjs";
import { parseAdminListQuery } from "./list-query.mjs";
import { createAdminPageToken, verifyAdminPageToken } from "./page-token.mjs";

const LIST_OPERATION_FILTERS = Object.freeze({
  "users.list": [],
  "products.list": ["status"],
  "stores.list": ["status"],
  "reports.list": ["status"],
  "audit.list": ["targetType"]
});

const SAFE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Authorization"
});

function response(status, payload) {
  return {
    status,
    headers: { ...SAFE_HEADERS, "Content-Type": "application/json; charset=utf-8" },
    body: payload
  };
}

/**
 * Framework-neutral request adapter.
 *
 * Reads use executeOperation. Mutations MUST use commitMutation, whose trusted
 * adapter is responsible for committing the domain change and append-only audit
 * event in one database transaction/batch. No separate post-mutation audit write
 * is allowed because it could fail after the business change has committed.
 */
export async function handleAdminRequest({
  request,
  operation,
  allowedOperations,
  verifyIdToken,
  resolveActiveRole,
  executeOperation,
  commitMutation,
  validateMutationInput,
  pageTokenSecret,
  isMutation = false,
  requestId
}) {
  const id = typeof requestId === "string" && requestId.trim().length > 0 && requestId.length <= 100
    ? requestId
    : randomUUID();

  if (!request || typeof request.method !== "string") {
    return response(400, { ok: false, error: { code: "BAD_REQUEST", message: "Invalid request" }, requestId: id });
  }
  if (request.method.toUpperCase() !== (isMutation ? "POST" : "GET")) {
    return response(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }, requestId: id });
  }

  const auth = await authorizeAdminRequest({
    authorization: request.headers?.authorization,
    verifyIdToken,
    resolveActiveRole,
    requiredOperation: operation,
    allowedOperations
  });
  if (!auth.ok) {
    return response(auth.status, { ok: false, error: { code: auth.code, message: "Request not permitted" }, requestId: id });
  }

  let listQuery;
  if (!isMutation && Object.hasOwn(LIST_OPERATION_FILTERS, operation)) {
    const parsed = parseAdminListQuery(request.query ?? {}, { allowedFilters: LIST_OPERATION_FILTERS[operation] });
    if (!parsed.ok) {
      return response(400, { ok: false, error: { code: parsed.code, message: "Invalid list query" }, requestId: id });
    }
    listQuery = parsed.value;
    // The current Firestore adapter has no reviewed indexed search/filter
    // implementation. Reject these client options as a client error before
    // invoking the adapter rather than turning them into an internal 500.
    if (listQuery.q || Object.keys(listQuery.filters).length > 0) {
      return response(400, { ok: false, error: { code: "UNSUPPORTED_QUERY_FEATURE", message: "Search and filters are not available yet" }, requestId: id });
    }
  } else if (!isMutation && request.query && Object.keys(request.query).length > 0) {
    return response(400, { ok: false, error: { code: "UNSUPPORTED_QUERY_PARAMETER", message: "Invalid query" }, requestId: id });
  }

  let cursorPosition;
  const pageContext = listQuery ? {
    actorUid: auth.identity.uid,
    operation,
    query: listQuery.q,
    filters: listQuery.filters,
    order: "createdAt_desc",
    pageSize: listQuery.pageSize
  } : null;

  if (listQuery?.pageToken) {
    if (typeof pageTokenSecret !== "string" || Buffer.byteLength(pageTokenSecret, "utf8") < 32) {
      return response(503, { ok: false, error: { code: "PAGINATION_NOT_CONFIGURED", message: "Operation is not configured" }, requestId: id });
    }
    const verified = verifyAdminPageToken({ token: listQuery.pageToken, context: pageContext, secret: pageTokenSecret });
    if (!verified.ok) {
      return response(400, { ok: false, error: { code: verified.code, message: "Invalid page token" }, requestId: id });
    }
    cursorPosition = verified.position;
  }

  const handler = isMutation ? commitMutation : executeOperation;
  if (isMutation && typeof validateMutationInput !== "function") {
    return response(503, {
      ok: false,
      error: { code: "MUTATION_VALIDATION_NOT_CONFIGURED", message: "Operation is not configured" },
      requestId: id
    });
  }
  if (typeof handler !== "function") {
    return response(503, {
      ok: false,
      error: { code: isMutation ? "ATOMIC_COMMIT_NOT_CONFIGURED" : "SERVICE_UNAVAILABLE", message: "Operation is not configured" },
      requestId: id
    });
  }

  try {
    const context = {
      actorUid: auth.identity.uid,
      actorRole: "admin",
      operation,
      requestId: id
    };
    let data;
    if (isMutation) {
      const validated = await validateMutationInput({ operation, body: request.body });
      if (!validated || validated.ok !== true) {
        return response(400, {
          ok: false,
          error: { code: "INVALID_MUTATION_INPUT", message: "Invalid mutation input" },
          requestId: id
        });
      }
      data = await commitMutation({ ...context, body: validated.value });
    } else {
      data = await executeOperation({
          actorUid: auth.identity.uid,
          operation,
          ...(listQuery ? {
            query: { ...listQuery, pageToken: null },
            ...(cursorPosition !== undefined ? { cursorPosition } : {})
          } : {})
        });
    }

    if (listQuery && data && typeof data === "object" && Object.hasOwn(data, "nextPosition")) {
      if (!pageTokenSecret) {
        return response(503, { ok: false, error: { code: "PAGINATION_NOT_CONFIGURED", message: "Operation is not configured" }, requestId: id });
      }
      const { nextPosition, ...publicData } = data;
      const nextPageToken = nextPosition == null ? null : createAdminPageToken({
        position: nextPosition, context: pageContext, secret: pageTokenSecret
      });
      return response(200, { ok: true, data: { ...publicData, nextPageToken }, requestId: id });
    }

    return response(200, { ok: true, data, requestId: id });
  } catch {
    return response(500, { ok: false, error: { code: "INTERNAL_ERROR", message: "Operation failed" }, requestId: id });
  }
}
