import { authorizeAdminRequest } from "./authz.mjs";

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
 * Framework-neutral request adapter. The host runtime must translate this
 * result to its HTTP response and inject real token verification, role lookup,
 * operation handlers and append-only audit storage.
 */
export async function handleAdminRequest({
  request,
  operation,
  allowedOperations,
  verifyIdToken,
  resolveActiveRole,
  executeOperation,
  writeAuditEvent,
  isMutation = false,
  requestId
}) {
  const id = typeof requestId === "string" && requestId.length <= 100
    ? requestId
    : "request-id-unavailable";

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

  if (typeof executeOperation !== "function") {
    return response(503, { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Operation is not configured" }, requestId: id });
  }

  try {
    const data = await executeOperation({
      actorUid: auth.identity.uid,
      operation,
      body: isMutation ? request.body : undefined
    });

    if (isMutation) {
      if (typeof writeAuditEvent !== "function") {
        return response(503, { ok: false, error: { code: "AUDIT_NOT_CONFIGURED", message: "Operation unavailable" }, requestId: id });
      }
      await writeAuditEvent({
        actorUid: auth.identity.uid,
        actorRole: "admin",
        operation,
        requestId: id
      });
    }
    return response(200, { ok: true, data, requestId: id });
  } catch {
    return response(500, { ok: false, error: { code: "INTERNAL_ERROR", message: "Operation failed" }, requestId: id });
  }
}
