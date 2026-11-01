import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import english from "./catalogs/en.mjs";
import gujarati from "./catalogs/gu.mjs";
import hindi from "./catalogs/hi.mjs";
import {
  createTranslator,
  loadTranslator,
  normalizeLocale,
  SUPPORTED_LOCALES,
} from "./i18n.mjs";
import {
  LOCALE_STORAGE_KEY,
  readLocalePreference,
  writeLocalePreference,
} from "./preference.mjs";

const catalogs = { en: english, gu: gujarati, hi: hindi };
const placeholders = (value) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

for (const { code } of SUPPORTED_LOCALES) {
  test(`${code} catalog has full key, plural and interpolation parity with English`, () => {
    const catalog = catalogs[code];
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(english).sort());
    for (const key of Object.keys(english)) {
      const entries =
        typeof english[key] === "string"
          ? { text: english[key] }
          : english[key];
      const translated =
        typeof catalog[key] === "string"
          ? { text: catalog[key] }
          : catalog[key];
      assert.deepEqual(
        Object.keys(translated).sort(),
        Object.keys(entries).sort(),
        key,
      );
      for (const form of Object.keys(entries)) {
        assert.equal(typeof translated[form], "string", key);
        assert.equal(translated[form].trim().length > 0, true, key);
        assert.doesNotMatch(translated[form], /[<>]|undefined|null/, key);
        assert.deepEqual(
          placeholders(translated[form]),
          placeholders(entries[form]),
          key,
        );
      }
    }
  });
  test(`${code} lazy loader returns the requested catalog and formats local numbers`, async () => {
    const translator = await loadTranslator(code);
    assert.equal(translator.locale, code);
    assert.equal(translator.t("browseTab"), catalogs[code].browseTab);
    const tag = SUPPORTED_LOCALES.find((locale) => locale.code === code).tag;
    assert.equal(
      translator.number(123456.5),
      new Intl.NumberFormat(tag).format(123456.5),
    );
    assert.equal(
      translator.currency(1500),
      new Intl.NumberFormat(tag, { style: "currency", currency: "INR" }).format(
        1500,
      ),
    );
    const date = new Date("2026-11-02T00:00:00Z");
    assert.equal(
      translator.date(date, { timeZone: "UTC" }),
      new Intl.DateTimeFormat(tag, { timeZone: "UTC" }).format(date),
    );
  });
}

test("all marked template strings exist and have translations", async () => {
  const html = await readFile(
    new URL("../../service-preview.html", import.meta.url),
    "utf8",
  );
  const keys = [
    ...html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.equal(keys.length > 60, true);
  for (const key of keys)
    for (const catalog of Object.values(catalogs))
      assert.equal(Object.hasOwn(catalog, key), true, key);
  assert.match(gujarati.heroTitle, /[\p{Script=Gujarati}]/u);
  assert.match(hindi.heroTitle, /[\p{Script=Devanagari}]/u);
});

test("fallback uses English grammar for missing or malformed selected entries", () => {
  for (const catalog of [
    {},
    { resultCount: null },
    { resultCount: { other: false } },
  ]) {
    const translator = createTranslator("hi", catalog);
    assert.equal(translator.t("resultCount", { count: 0 }), "0 demo profiles");
    assert.equal(translator.t("resultCount", { count: 1 }), "1 demo profile");
  }
  const translator = createTranslator(
    "gu",
    Object.create({ browseTab: "forged" }),
  );
  assert.equal(translator.t("browseTab"), "Find services");
  assert.equal(translator.t("missing.key"), "[missing.key]");
  assert.equal(translator.t(null), "[missing translation]");
});

test("interpolation is text-only, own-property-only, and missing values remain visible", () => {
  const translator = createTranslator("en");
  assert.equal(
    translator.t("languageChanged", { language: "<img onerror=alert(1)>" }),
    "Interface language: <img onerror=alert(1)>",
  );
  assert.equal(
    translator.t("languageChanged", Object.create({ language: "forged" })),
    "Interface language: [language]",
  );
  assert.equal(
    translator.t("languageChanged", null),
    "Interface language: [language]",
  );
  assert.equal(translator.number(NaN), "");
  assert.equal(translator.number(Infinity), "");
  assert.equal(translator.date(new Date("invalid")), "");
});

test("only explicit supported language codes are accepted; no input selects an import path", async () => {
  assert.deepEqual(
    SUPPORTED_LOCALES.map((locale) => locale.code),
    ["gu", "en", "hi"],
  );
  for (const value of [
    "fr",
    "hi-IN",
    "../../private",
    "__proto__",
    "toString",
    null,
    "EN",
  ]) {
    assert.equal(normalizeLocale(value), "en");
    assert.equal((await loadTranslator(value)).locale, "en");
  }
});

test("locale preference persists only one allowlisted code and survives unavailable storage", () => {
  const writes = [];
  const storage = {
    getItem: (key) => (key === LOCALE_STORAGE_KEY ? "hi" : null),
    setItem: (...args) => writes.push(args),
  };
  assert.equal(readLocalePreference(storage), "hi");
  assert.equal(writeLocalePreference(storage, "gu"), true);
  assert.deepEqual(writes, [[LOCALE_STORAGE_KEY, "gu"]]);
  for (const value of ["fr", { displayName: "private" }, "GU", ""])
    assert.equal(writeLocalePreference(storage, value), false);
  assert.equal(writes.length, 1);
  assert.equal(
    readLocalePreference(
      {
        getItem() {
          throw new Error("blocked");
        },
      },
      "gu",
    ),
    "gu",
  );
  assert.equal(readLocalePreference({ getItem: () => "malicious" }), "en");
  assert.equal(
    writeLocalePreference(
      {
        setItem() {
          throw new Error("quota");
        },
      },
      "hi",
    ),
    false,
  );
  assert.equal(writeLocalePreference(null, "en"), false);
});
