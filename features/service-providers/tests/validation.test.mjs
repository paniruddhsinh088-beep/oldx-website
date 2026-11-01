/**
 * Local browser test runner for OLDX's isolated service provider form.
 * Run with: node --test features/service-providers/tests/validation.test.mjs
 * Does not contact Firebase or write any data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../profile-form.js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { validateServiceProviderProfile, SERVICE_CATEGORIES } = await import(moduleUrl);
const base = {
  displayName: "Sample Provider",
  description: "Home repairs",
  city: "Ahmedabad",
  district: "Ahmedabad",
  serviceCategories: ["carpenter", "plumber"]
};

test("accepts two services", () => assert.equal(validateServiceProviderProfile(base).valid, true));
test("deduplicates services", () => assert.deepEqual(
  validateServiceProviderProfile({...base, serviceCategories:["carpenter","carpenter"]}).value.serviceCategories,
  ["carpenter"]
));
test("rejects empty services", () => assert.equal(validateServiceProviderProfile({...base, serviceCategories:[]}).valid,false));
test("rejects unknown service", () => assert.equal(validateServiceProviderProfile({...base, serviceCategories:["fake"]}).valid,false));
test("rejects missing city", () => assert.equal(validateServiceProviderProfile({...base, city:""}).valid,false));
test("rejects overlong name", () => assert.equal(validateServiceProviderProfile({...base, displayName:"x".repeat(81)}).valid,false));
test("rejects overlong description", () => assert.equal(validateServiceProviderProfile({...base, description:"x".repeat(1001)}).valid,false));
test("trims city", () => assert.equal(validateServiceProviderProfile({...base, city:" Ahmedabad "}).value.city,"Ahmedabad"));
test("allows only Gujarat state in normalized value", () => assert.equal(validateServiceProviderProfile(base).value.state,"Gujarat"));
test("category identifiers are unique", () => assert.equal(new Set(SERVICE_CATEGORIES.map(c=>c.id)).size,SERVICE_CATEGORIES.length));
