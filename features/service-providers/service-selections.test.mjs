import test from "node:test";
import assert from "node:assert/strict";
import { normalizeServiceSelections } from "./service-selections.mjs";

test("accepts multiple distinct Gujarati and English service names", () => {
  assert.deepEqual(normalizeServiceSelections([" Carpenter ", "પ્લમ્બર", "Electrician"]), {
    ok: true, services: ["Carpenter", "પ્લમ્બર", "Electrician"]
  });
});

test("rejects empty, non-array and oversized service lists", () => {
  for (const input of [null, [], "Carpenter", Array(13).fill("Carpenter")]) {
    assert.deepEqual(normalizeServiceSelections(input), { ok: false, code: "INVALID_SERVICES" });
  }
});

test("rejects repeated service names ignoring case and surrounding spaces", () => {
  assert.deepEqual(normalizeServiceSelections(["Carpenter", " carpenter "]), {
    ok: false, code: "DUPLICATE_SERVICE"
  });
});

test("rejects invalid entries and markup-like input", () => {
  for (const input of [[null], [""], [" "], ["<script>"], ["a".repeat(65)]]) {
    assert.deepEqual(normalizeServiceSelections(input), { ok: false, code: "INVALID_SERVICES" });
  }
});
