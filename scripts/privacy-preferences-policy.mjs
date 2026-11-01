const DEFAULT_PREFERENCES = Object.freeze({
  schemaVersion: 1,
  contact: Object.freeze({ phoneVisibility: "private", whatsappVisibility: "private" }),
  location: Object.freeze({ publicDisplay: "hidden", exactLocationSharing: "private" }),
  presence: Object.freeze({ onlineVisibility: "hidden", lastSeenVisibility: "hidden" }),
  notifications: Object.freeze({ messagePreview: "generic" }),
});

const ALLOWED = Object.freeze({
  "contact.phoneVisibility": ["private", "selectedListings", "selectedStores"],
  "contact.whatsappVisibility": ["private", "selectedListings", "selectedStores"],
  "location.publicDisplay": ["hidden", "approximateArea"],
  "location.exactLocationSharing": ["private", "explicitFeatureConsent"],
  "presence.onlineVisibility": ["hidden", "visible"],
  "presence.lastSeenVisibility": ["hidden", "approximate"],
  "notifications.messagePreview": ["generic", "full"],
});

const CONSENT_PURPOSES = new Set(["displayContact", "displayExactLocation"]);
const CONSENT_FIELDS = new Set(["phone", "whatsapp", "exactLocation"]);
const SCOPE_TYPES = new Set(["listing", "store", "feature"]);

function cloneDefaults() {
  return {
    schemaVersion: DEFAULT_PREFERENCES.schemaVersion,
    contact: { ...DEFAULT_PREFERENCES.contact },
    location: { ...DEFAULT_PREFERENCES.location },
    presence: { ...DEFAULT_PREFERENCES.presence },
    notifications: { ...DEFAULT_PREFERENCES.notifications },
  };
}

export function normalizePreferences(input) {
  const result = cloneDefaults();
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  for (const [path, allowed] of Object.entries(ALLOWED)) {
    const [group, field] = path.split(".");
    const value = input[group]?.[field];
    if (allowed.includes(value)) result[group][field] = value;
  }
  return result;
}

export function validatePreferencePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !Object.hasOwn(ALLOWED, key))) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  for (const key of keys) {
    if (!ALLOWED[key].includes(patch[key])) return { ok: false, code: "VALIDATION_FAILED" };
  }
  return { ok: true, values: { ...patch } };
}

export function applyPreferencePatch(current, patch) {
  const validation = validatePreferencePatch(patch);
  if (!validation.ok) return validation;
  const next = normalizePreferences(current);
  for (const [path, value] of Object.entries(validation.values)) {
    const [group, field] = path.split(".");
    next[group][field] = value;
  }
  return { ok: true, preferences: next };
}

export function validateConsentRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  const { purpose, field, scopeType, scopeId, policyVersion } = request;
  if (!CONSENT_PURPOSES.has(purpose) || !CONSENT_FIELDS.has(field) ||
      !SCOPE_TYPES.has(scopeType) || typeof scopeId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(scopeId) ||
      typeof policyVersion !== "string" || !/^v[1-9][0-9]*$/.test(policyVersion)) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  if ((purpose === "displayContact" && !["phone", "whatsapp"].includes(field)) ||
      (purpose === "displayExactLocation" && field !== "exactLocation")) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  return { ok: true, consent: { purpose, field, scopeType, scopeId, policyVersion } };
}

export function isConsentActiveForScope(consents, expected) {
  if (!Array.isArray(consents) || !expected) return false;
  return consents.some((consent) =>
    consent && consent.status === "active" && consent.revokedAt == null &&
    consent.purpose === expected.purpose && consent.field === expected.field &&
    consent.scopeType === expected.scopeType && consent.scopeId === expected.scopeId &&
    consent.policyVersion === expected.policyVersion
  );
}
