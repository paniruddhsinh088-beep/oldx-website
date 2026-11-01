import { normalizeServiceSelections } from "./service-selections.mjs";

/**
 * Draft provider profile input validator. Pure and review-only:
 * no Firebase writes, auth decisions, or media uploads.
 * Identity/ownership, ratings and verification are server-controlled elsewhere.
 */
const allowedFields = new Set([
  "displayName", "services", "description", "city", "serviceArea",
  "experienceYears", "available", "languages"
]);

function cleanText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max || /[<>\u0000-\u001f\u007f]/u.test(text)) return null;
  return text;
}

export function normalizeProviderProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype) {
    return { ok: false, code: "INVALID_PROFILE" };
  }
  const keys = Object.keys(input);
  if (keys.some(key => !allowedFields.has(key))) {
    return { ok: false, code: "UNSUPPORTED_PROFILE_FIELD" };
  }

  const displayName = cleanText(input.displayName, 80);
  const city = cleanText(input.city, 80);
  const serviceArea = cleanText(input.serviceArea, 120);
  const description = input.description === undefined || input.description === "" ? "" : cleanText(input.description, 1200);
  const services = normalizeServiceSelections(input.services);
  if (!displayName || !city || !serviceArea || description === null || !services.ok) {
    return { ok: false, code: "INVALID_PROFILE" };
  }

  const years = input.experienceYears;
  if (years !== undefined && (!Number.isInteger(years) || years < 0 || years > 80)) {
    return { ok: false, code: "INVALID_PROFILE" };
  }
  if (input.available !== undefined && typeof input.available !== "boolean") {
    return { ok: false, code: "INVALID_PROFILE" };
  }

  let languages = [];
  if (input.languages !== undefined) {
    if (!Array.isArray(input.languages) || input.languages.length > 3 ||
        input.languages.some(lang => !["gu", "hi", "en"].includes(lang)) ||
        new Set(input.languages).size !== input.languages.length) {
      return { ok: false, code: "INVALID_PROFILE" };
    }
    languages = [...input.languages];
  }
  return {
    ok: true,
    value: {
      displayName, city, serviceArea, description, services: services.services,
      experienceYears: years ?? null, available: input.available ?? true, languages
    }
  };
}
