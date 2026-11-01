/**
 * OLDX Service Provider draft helper (review-only, not wired to Firestore).
 * A provider may advertise several distinct services.
 * Does not grant ownership or write permissions.
 */
export function normalizeServiceSelections(values, { maxServices = 12 } = {}) {
  if (!Array.isArray(values) || values.length === 0 || values.length > maxServices) {
    return { ok: false, code: "INVALID_SERVICES" };
  }
  const selected = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string") return { ok: false, code: "INVALID_SERVICES" };
    const service = value.trim();
    if (!service || service.length > 64 || !/^[\p{L}\p{N}][\p{L}\p{N} .&/()+-]*$/u.test(service)) {
      return { ok: false, code: "INVALID_SERVICES" };
    }
    const key = service.toLocaleLowerCase("en");
    if (seen.has(key)) return { ok: false, code: "DUPLICATE_SERVICE" };
    seen.add(key);
    selected.push(service);
  }
  return { ok: true, services: selected };
}
