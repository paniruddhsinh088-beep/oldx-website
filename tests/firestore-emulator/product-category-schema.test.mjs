import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_CATEGORIES, validateProductCategory, projectPublicAttributes } from "./product-category-schema.mjs";

test("all current UI category IDs and subcategories are represented", () => {
  assert.equal(Object.keys(PRODUCT_CATEGORIES).length, 12);
  for (const [category, subs] of Object.entries(PRODUCT_CATEGORIES)) {
    for (const sub of subs) assert.equal(validateProductCategory(category, sub), true);
  }
});

test("unknown categories and mismatched subcategories are rejected", () => {
  assert.equal(validateProductCategory("unknown", "Cars / 4 Wheelers"), false);
  assert.equal(validateProductCategory("cars", "Mobile Phones"), false);
  assert.equal(validateProductCategory("cars", ""), false);
});

test("cars accept only UI-listed brand and bounded model", () => {
  assert.deepEqual(
    projectPublicAttributes("cars", { brand: "Tata", model: "Nexon" }),
    { brand: "Tata", model: "Nexon" }
  );
  assert.equal(projectPublicAttributes("cars", { brand: "Unlisted Brand", model: "Nexon" }), null);
  assert.equal(projectPublicAttributes("cars", { brand: "Tata", model: "x".repeat(81) }), null);
});

test("non-car categories accept only bounded generic type", () => {
  assert.deepEqual(projectPublicAttributes("mobiles", { type: "Android phone" }), { type: "Android phone" });
  assert.deepEqual(projectPublicAttributes("jobs", { type: "Driver" }), { type: "Driver" }); // subcategory is validated separately
  assert.equal(projectPublicAttributes("properties", { type: "x".repeat(121) }), null);
});

test("category-specific keys cannot be smuggled across categories", () => {
  assert.equal(projectPublicAttributes("cars", { brand: "Tata", model: "Nexon", type: "extra" }), null);
  assert.equal(projectPublicAttributes("bikes", { brand: "Honda", model: "Activa" }), null);
  assert.equal(projectPublicAttributes("bikes", { type: "Scooter", extra: "unexpected" }), null);
});

test("nested, array, numeric, boolean and unknown values are rejected", () => {
  for (const input of [
    null, [], "string",
    { type: { nested: true } },
    { type: ["array"] },
    { type: 123 },
    { type: true },
    { unknown: "value" }
  ]) assert.equal(projectPublicAttributes("furniture", input), null);
});

test("empty, control-character and overlong strings are rejected", () => {
  assert.equal(projectPublicAttributes("pets", { type: " " }), null);
  assert.equal(projectPublicAttributes("pets", { type: "bad\u0000value" }), null);
  assert.equal(projectPublicAttributes("pets", { type: "x".repeat(121) }), null);
});

test("input objects are not mutated", () => {
  const input = { brand: "Hyundai", model: "i20" };
  const before = structuredClone(input);
  projectPublicAttributes("cars", input);
  assert.deepEqual(input, before);
});
