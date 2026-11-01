import { normalizeLocale } from "./i18n.mjs";

export const LOCALE_STORAGE_KEY = "oldx.preview.locale.v1";

// This adapter stores exactly one allowlisted UI preference. It never receives
// profile drafts, contact consent, auth identifiers or public account records.
export function readLocalePreference(storage, fallback = "en") {
  try {
    return normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY), fallback);
  } catch {
    return normalizeLocale(fallback);
  }
}

export function writeLocalePreference(storage, locale) {
  if (!["gu", "en", "hi"].includes(locale)) return false;
  try {
    if (typeof storage?.setItem !== "function") return false;
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
