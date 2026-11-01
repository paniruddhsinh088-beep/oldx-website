import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicProviderCard } from "./provider-public-card.mjs";

const provider = {
  id: "provider-1", displayName: "કિરણભાઈ", city: "અમદાવાદ",
  serviceArea: "બોપલ", services: ["Carpenter", "Furniture repair"],
  available: true, experienceYears: 7,
  phone: "private", email: "private@example.com",
  ownerUid: "private-uid", exactLocation: { lat: 1, lng: 2 },
  verified: true, rating: 5, admin: true
};

test("builds a multilingual multi-service public card", () => {
  const result = buildPublicProviderCard(provider);
  assert.equal(result.ok, true);
  assert.deepEqual(result.card.services, ["Carpenter", "Furniture repair"]);
  assert.equal(result.card.displayName, "કિરણભાઈ");
});

test("never exposes private contact, location or unverified claims", () => {
  const { card } = buildPublicProviderCard(provider);
  for (const key of ["phone", "email", "ownerUid", "exactLocation", "verified", "rating", "admin"]) {
    assert.equal(Object.hasOwn(card, key), false);
  }
});

test("rejects invalid public cards", () => {
  for (const input of [
    null, {}, { ...provider, services: [] },
    { ...provider, displayName: "<script>" },
    { ...provider, available: "yes" },
    { ...provider, experienceYears: -1 }
  ]) {
    assert.equal(buildPublicProviderCard(input).ok, false);
  }
});

test("returns a new independent service list", () => {
  const result = buildPublicProviderCard(provider);
  result.card.services.push("New");
  assert.deepEqual(provider.services, ["Carpenter", "Furniture repair"]);
});
