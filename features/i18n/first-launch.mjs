import { SUPPORTED_LOCALES, loadTranslator } from './i18n.mjs';
import { LOCALE_STORAGE_KEY, writeLocalePreference } from './preference.mjs';

const ALLOWED = new Set(SUPPORTED_LOCALES.map(({ code }) => code));

// Preview-only first-launch flow. Never infer language from browser, GPS, IP,
// account data, or a public profile. Nothing is saved until an explicit choice.
export function createFirstLaunchLanguageFlow({ storage, load = loadTranslator } = {}) {
  let revision = 0;
  let initialLocale = null;
  try {
    const stored = storage?.getItem?.(LOCALE_STORAGE_KEY);
    if (ALLOWED.has(stored)) initialLocale = stored;
  } catch {
    // Storage may be disabled; keep the picker usable without persistence.
  }

  async function resolve(locale, persist) {
    if (!ALLOWED.has(locale)) return { ok: false, reason: 'invalid' };
    const request = ++revision;
    let translator;
    try {
      translator = await load(locale);
    } catch {
      return request === revision
        ? { ok: false, reason: 'unavailable' }
        : { ok: false, reason: 'stale' };
    }
    if (request !== revision) return { ok: false, reason: 'stale' };
    if (!translator || translator.locale !== locale || typeof translator.t !== 'function') {
      return { ok: false, reason: 'unavailable' };
    }
    const persisted = persist ? writeLocalePreference(storage, locale) : true;
    return { ok: true, locale, translator, persisted };
  }

  return Object.freeze({
    initialLocale,
    needsChoice: initialLocale === null,
    select(locale) { return resolve(locale, true); },
    restore() {
      return initialLocale === null
        ? Promise.resolve({ ok: false, reason: 'missing' })
        : resolve(initialLocale, false);
    },
    cancelPending() { revision += 1; },
  });
}
