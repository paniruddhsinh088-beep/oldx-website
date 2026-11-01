import english from "./catalogs/en.mjs";

export const SUPPORTED_LOCALES = Object.freeze([
  Object.freeze({ code: "gu", tag: "gu-IN", name: "ગુજરાતી" }),
  Object.freeze({ code: "en", tag: "en-IN", name: "English" }),
  Object.freeze({ code: "hi", tag: "hi-IN", name: "हिन्दी" }),
]);
const tags = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [locale.code, locale.tag]),
);
const loaders = Object.freeze({
  en: () => import("./catalogs/en.mjs"),
  gu: () => import("./catalogs/gu.mjs"),
  hi: () => import("./catalogs/hi.mjs"),
});

export function normalizeLocale(value, fallback = "en") {
  return typeof value === "string" && Object.hasOwn(tags, value)
    ? value
    : typeof fallback === "string" && Object.hasOwn(tags, fallback)
      ? fallback
      : "en";
}

// Text only. Callers render with textContent, never HTML. Catalogs cannot select
// routes, permissions, remote URLs, account fields or business rules.
export function createTranslator(locale, catalog = english) {
  const code = normalizeLocale(locale);
  const tag = tags[code];
  const number = (value, options = {}) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    try {
      return new Intl.NumberFormat(tag, options).format(value);
    } catch {
      return "";
    }
  };
  function t(key, params = {}) {
    if (typeof key !== "string" || !/^[a-zA-Z][\w.]{0,100}$/.test(key))
      return "[missing translation]";
    const count =
      params && Object.hasOwn(params, "count") ? params.count : undefined;
    function message(value, language) {
      if (typeof value === "string" && value.trim()) return value;
      if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
      const category =
        typeof count === "number" && Number.isFinite(count)
          ? new Intl.PluralRules(language).select(count)
          : "other";
      const selected = Object.hasOwn(value, category)
        ? value[category]
        : Object.hasOwn(value, "other")
          ? value.other
          : undefined;
      return typeof selected === "string" && selected.trim()
        ? selected
        : undefined;
    }
    const template =
      message(
        catalog && Object.hasOwn(catalog, key) ? catalog[key] : undefined,
        tag,
      ) ??
      message(Object.hasOwn(english, key) ? english[key] : undefined, "en-IN");
    if (template === undefined) return `[${key}]`;
    return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, name) => {
      if (!params || !Object.hasOwn(params, name)) return `[${name}]`;
      const value = params[name];
      return typeof value === "number" && Number.isFinite(value)
        ? number(value)
        : typeof value === "string"
          ? value
          : `[${name}]`;
    });
  }
  return Object.freeze({
    locale: code,
    t,
    number,
    currency: (value) => number(value, { style: "currency", currency: "INR" }),
    date(value, options = {}) {
      if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
        return "";
      try {
        return new Intl.DateTimeFormat(tag, options).format(value);
      } catch {
        return "";
      }
    },
  });
}

export async function loadTranslator(locale) {
  const code = normalizeLocale(locale);
  const { default: catalog } = await loaders[code]();
  return createTranslator(code, catalog);
}
