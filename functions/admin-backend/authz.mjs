/**
 * Framework-neutral Admin authorization helpers.
 * A production adapter must inject Firebase Admin token verification and
 * a server-controlled role resolver. Never trust request-body identity/role.
 */
export async function authorizeAdminRequest({
  authorization,
  verifyIdToken,
  resolveActiveRole,
  requiredOperation,
  allowedOperations
}) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  }
  if (typeof verifyIdToken !== "function" || typeof resolveActiveRole !== "function") {
    return { ok: false, status: 503, code: "AUTHORIZATION_NOT_CONFIGURED" };
  }

  const token = authorization.slice(7).trim();
  if (!token) return { ok: false, status: 401, code: "UNAUTHENTICATED" };

  let identity;
  try {
    identity = await verifyIdToken(token);
  } catch {
    return { ok: false, status: 401, code: "INVALID_TOKEN" };
  }

  if (!identity || typeof identity.uid !== "string" || !identity.uid) {
    return { ok: false, status: 401, code: "INVALID_TOKEN" };
  }

  let role;
  try {
    role = await resolveActiveRole(identity.uid);
  } catch {
    return { ok: false, status: 503, code: "ROLE_LOOKUP_FAILED" };
  }

  if (role !== "admin") return { ok: false, status: 403, code: "FORBIDDEN" };
  if (!Array.isArray(allowedOperations) || !allowedOperations.includes(requiredOperation)) {
    return { ok: false, status: 403, code: "OPERATION_NOT_ALLOWED" };
  }

  return { ok: true, identity: { uid: identity.uid }, role: "admin" };
}
