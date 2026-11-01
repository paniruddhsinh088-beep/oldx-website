/**
 * Pure, review-only search helper for public provider cards.
 * Caller must supply only server-approved public profiles; this function
 * is not an access-control boundary and never reads Firebase.
 */
function folded(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en") : "";
}
function publicProvider(record) {
  return record && typeof record === "object" && !Array.isArray(record) &&
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.displayName === "string" && typeof record.city === "string" &&
    Array.isArray(record.services) && record.services.every(s => typeof s === "string") &&
    typeof record.available === "boolean";
}

export function searchServiceProviders(records, filters = {}) {
  if (!Array.isArray(records) || !filters || typeof filters !== "object" ||
      Array.isArray(filters) || Object.getPrototypeOf(filters) !== Object.prototype) {
    return { ok: false, code: "INVALID_SEARCH" };
  }
  const allowed = new Set(["query", "service", "city", "availableOnly", "minExperienceYears", "limit"]);
  if (Object.keys(filters).some(key => !allowed.has(key))) {
    return { ok: false, code: "INVALID_SEARCH" };
  }
  const { query = "", service = "", city = "", availableOnly = false, minExperienceYears = 0, limit = 20 } = filters;
  if ([query, service, city].some(s => typeof s !== "string" || s.length > 100) ||
      typeof availableOnly !== "boolean" || !Number.isInteger(minExperienceYears) ||
      minExperienceYears < 0 || minExperienceYears > 80 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { ok: false, code: "INVALID_SEARCH" };
  }
  const q = folded(query), selectedService = folded(service), selectedCity = folded(city);
  const matches = records.filter(provider => {
    if (!publicProvider(provider)) return false;
    if (availableOnly && !provider.available) return false;
    if (selectedCity && !folded(provider.city).includes(selectedCity)) return false;
    if (selectedService && !provider.services.some(s => folded(s) === selectedService)) return false;
    if (minExperienceYears > 0 &&
        (!Number.isInteger(provider.experienceYears) || provider.experienceYears < minExperienceYears)) return false;
    if (q && ![provider.displayName, provider.city, ...provider.services].some(s => folded(s).includes(q))) return false;
    return true;
  });
  return { ok: true, ids: matches.slice(0, limit).map(p => p.id), total: matches.length };
}
