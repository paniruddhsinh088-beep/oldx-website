import test from "node:test";
import assert from "node:assert/strict";
import { searchServiceProviders } from "./provider-search.mjs";

const providers = [
  { id: "a", displayName: "કિરણ", city: "અમદાવાદ", services: ["Carpenter", "Painter"], available: true, experienceYears: 8 },
  { id: "b", displayName: "Ravi", city: "Surat", services: ["Plumber"], available: false, experienceYears: 12 },
  { id: "c", displayName: "Amit", city: "Ahmedabad", services: ["Electrician", "Plumber"], available: true, experienceYears: 3 }
];

test("filters by city and available service", () => {
  assert.deepEqual(searchServiceProviders(providers, { city: "ahmedabad", availableOnly: true }).ids, ["c"]);
  assert.deepEqual(searchServiceProviders(providers, { service: "Plumber", availableOnly: true }).ids, ["c"]);
});

test("supports Gujarati search and multiple services per provider", () => {
  assert.deepEqual(searchServiceProviders(providers, { query: "કિરણ" }).ids, ["a"]);
  assert.deepEqual(searchServiceProviders(providers, { service: "Painter" }).ids, ["a"]);
});

test("filters by minimum experience and limits results", () => {
  assert.deepEqual(searchServiceProviders(providers, { minExperienceYears: 8 }).ids, ["a", "b"]);
  assert.deepEqual(searchServiceProviders(providers, { limit: 1 }), { ok: true, ids: ["a"], total: 3 });
});

test("rejects malformed filters and excludes incomplete public records", () => {
  for (const filters of [{ limit: 0 }, { limit: 51 }, { availableOnly: "yes" }, { ownerUid: "x" }]) {
    assert.equal(searchServiceProviders(providers, filters).ok, false);
  }
  assert.deepEqual(searchServiceProviders([{ id: "x", displayName: "Missing fields" }]).ids, []);
});

test('matches canonically equivalent Hindi and Latin text without rewriting provider data', () => {
  const record = { id: 'unicode', displayName: 'क़ासिम', city: 'Café',
    services: ['Réparation'], available: true, experienceYears: 4 };
  const original = structuredClone(record);
  for (const filters of [{ query: 'क़ासिम' }, { city: 'Cafe\u0301' }, { service: 'Re\u0301paration' }]) {
    assert.deepEqual(searchServiceProviders([record], filters).ids, ['unicode']);
  }
  assert.deepEqual(record, original);
});
