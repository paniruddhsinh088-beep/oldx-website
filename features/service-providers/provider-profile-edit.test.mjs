import test from "node:test";
import assert from "node:assert/strict";
import { prepareProviderProfileEdit } from "./provider-profile-edit.mjs";

const existing = {
  displayName: "Kiran", services: ["Carpenter", "Painter"],
  city: "Ahmedabad", serviceArea: "Bopal",
  description: "", experienceYears: null, available: true, languages: ["gu"]
};

test("editing one field preserves the remaining profile fields", () => {
  const result = prepareProviderProfileEdit(existing, { city: "Surat" });
  assert.equal(result.ok, true);
  assert.equal(result.value.city, "Surat");
  assert.deepEqual(result.value.services, ["Carpenter", "Painter"]);
  assert.equal(result.value.experienceYears, null);
  assert.equal(existing.city, "Ahmedabad");
});

test("provider can replace their service list without duplicate entries", () => {
  const result = prepareProviderProfileEdit(existing, { services: ["Plumber", "Electrician"] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.services, ["Plumber", "Electrician"]);
  assert.deepEqual(existing.services, ["Carpenter", "Painter"]);
});

test("rejects attempts to edit ownership, ratings and verification", () => {
  for (const field of ["ownerUid", "uid", "rating", "verified", "reviewCount", "role"]) {
    assert.deepEqual(prepareProviderProfileEdit(existing, { [field]: "forged" }), {
      ok: false, code: "UNSUPPORTED_PROFILE_EDIT"
    });
  }
});

test("rejects empty, malformed or invalid edits", () => {
  assert.equal(prepareProviderProfileEdit(existing, {}).ok, false);
  assert.equal(prepareProviderProfileEdit(existing, null).ok, false);
  assert.equal(prepareProviderProfileEdit(existing, { services: [] }).ok, false);
  assert.equal(prepareProviderProfileEdit(existing, { displayName: "<script>" }).ok, false);
});
