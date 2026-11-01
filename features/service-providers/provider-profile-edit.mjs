import { normalizeProviderProfile } from "./provider-profile.mjs";

const editableFields = new Set([
  "displayName", "services", "description", "city", "serviceArea",
  "experienceYears", "available", "languages"
]);

const plainRecord = value => value !== null && typeof value === "object" &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/**
 * Pure review-only edit preparation. No authentication, persistence or Firebase access.
 * The trusted server MUST verify ownership and concurrency before saving.
 * existing must be the current server-loaded profile, never caller-controlled data.
 */
export function prepareProviderProfileEdit(existing, changes) {
  if (!plainRecord(existing) || !plainRecord(changes)) {
    return { ok: false, code: "INVALID_PROFILE_EDIT" };
  }
  const keys = Object.keys(changes);
  if (!keys.length || keys.some(key => !editableFields.has(key))) {
    return { ok: false, code: "UNSUPPORTED_PROFILE_EDIT" };
  }
  // Do not merge unknown stored metadata or caller-controlled identity into the validator.
  const merged = {};
  for (const key of editableFields) {
    if (Object.hasOwn(changes, key)) {
      merged[key] = changes[key];
    } else if (Object.hasOwn(existing, key)) {
      merged[key] = existing[key];
    }
  }
  // A normalized existing profile uses null for an unspecified experience.
  if (merged.experienceYears === null) delete merged.experienceYears;
  return normalizeProviderProfile(merged);
}
