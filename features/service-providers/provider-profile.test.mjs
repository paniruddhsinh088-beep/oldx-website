import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderProfile } from "./provider-profile.mjs";

const valid = {
  displayName: " કિરણભાઈ ",
  services: ["Carpenter", "ફર્નિચર રિપેર"],
  city: "અમદાવાદ",
  serviceArea: "બોપલ અને આસપાસ",
  description: "ઘર અને ઓફિસમાં કામ",
  experienceYears: 7,
  available: true,
  languages: ["gu", "hi"]
};

test("normalizes a multilingual multi-service profile", () => {
  const result = normalizeProviderProfile(valid);
  assert.equal(result.ok, true);
  assert.equal(result.value.displayName, "કિરણભાઈ");
  assert.deepEqual(result.value.services, valid.services);
  assert.deepEqual(result.value.languages, ["gu", "hi"]);
});

test("rejects client-controlled role, rating and verification", () => {
  for (const field of ["uid", "ownerUid", "admin", "role", "rating", "verified", "reviewCount"]) {
    assert.deepEqual(normalizeProviderProfile({ ...valid, [field]: "forged" }), {
      ok: false, code: "UNSUPPORTED_PROFILE_FIELD"
    });
  }
});

test("rejects invalid years, language, availability and empty service area", () => {
  for (const patch of [
    { experienceYears: -1 }, { experienceYears: 1.5 },
    { languages: ["gu", "gu"] }, { languages: ["fr"] },
    { available: "yes" }, { serviceArea: " " }
  ]) {
    assert.equal(normalizeProviderProfile({ ...valid, ...patch }).ok, false);
  }
});

test("rejects markup and extra input fields", () => {
  assert.equal(normalizeProviderProfile({ ...valid, displayName: "<script>" }).ok, false);
  assert.equal(normalizeProviderProfile({ ...valid, website: "https://example.com" }).ok, false);
});

test("does not mutate caller data and uses safe optional defaults", () => {
  const source = { displayName: "Provider", services: ["Plumber"], city: "Surat", serviceArea: "Surat" };
  const result = normalizeProviderProfile(source);
  assert.equal(result.ok, true);
  assert.equal(result.value.available, true);
  assert.equal(result.value.experienceYears, null);
  assert.deepEqual(result.value.languages, []);
  assert.deepEqual(source, { displayName: "Provider", services: ["Plumber"], city: "Surat", serviceArea: "Surat" });
});
