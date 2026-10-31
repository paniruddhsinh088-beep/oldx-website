import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = 1;
const DEFAULT_TTL_SECONDS = 15 * 60;

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function contextFor(context) {
  if (!context || typeof context !== "object" ||
      typeof context.actorUid !== "string" || !context.actorUid ||
      typeof context.operation !== "string" || !context.operation) {
    throw new TypeError("Cursor context requires actorUid and operation.");
  }
  return {
    actorUid: context.actorUid,
    operation: context.operation,
    query: typeof context.query === "string" ? context.query : "",
    filters: context.filters && typeof context.filters === "object" ? context.filters : {},
    order: typeof context.order === "string" ? context.order : "createdAt_desc"
  };
}
function requireSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Cursor signing secret must be at least 32 bytes.");
  }
}

/** Create an integrity-protected, short-lived cursor bound to actor and query scope. */
export function createAdminPageToken({ position, context, secret, now = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS }) {
  requireSecret(secret);
  if (position == null) throw new TypeError("Cursor position is required.");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) {
    throw new TypeError("Cursor TTL must be between 1 and 3600 seconds.");
  }
  const payload = {
    v: VERSION,
    c: contextFor(context),
    p: position,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ttlSeconds
  };
  const encoded = encode(payload);
  const signed = encoded + "." + signature(encoded, secret);
  if (signed.length > 512) throw new TypeError("Cursor exceeds maximum length.");
  return signed;
}

/** Verify signature, expiry, and exact query/actor scope before returning position. */
export function verifyAdminPageToken({ token, context, secret, now = Date.now() }) {
  requireSecret(secret);
  if (typeof token !== "string" || token.length > 512) return { ok: false, code: "INVALID_PAGE_TOKEN" };
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    return { ok: false, code: "INVALID_PAGE_TOKEN" };
  }
  const expected = signature(parts[0], secret);
  if (!safeEqual(parts[1], expected)) return { ok: false, code: "INVALID_PAGE_TOKEN" };
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (payload.v !== VERSION || !Number.isInteger(payload.exp) ||
        payload.exp <= Math.floor(now / 1000) || payload.iat > Math.floor(now / 1000) + 30) {
      return { ok: false, code: "EXPIRED_OR_INVALID_PAGE_TOKEN" };
    }
    if (JSON.stringify(payload.c) !== JSON.stringify(contextFor(context))) {
      return { ok: false, code: "PAGE_TOKEN_SCOPE_MISMATCH" };
    }
    if (payload.p == null) return { ok: false, code: "INVALID_PAGE_TOKEN" };
    return { ok: true, position: payload.p };
  } catch {
    return { ok: false, code: "INVALID_PAGE_TOKEN" };
  }
}
