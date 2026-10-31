import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const emulatorConfig = JSON.parse(
  await readFile(new URL("../../firebase.emulator.json", import.meta.url), "utf8")
);
const rules = await readFile(
  new URL("./deny-all.rules", import.meta.url),
  "utf8"
);

test("emulator config loads only the isolated deny-all fixture", () => {
  assert.equal(
    emulatorConfig.firestore?.rules,
    "tests/firestore-emulator/deny-all.rules"
  );
  assert.equal(emulatorConfig.emulators?.firestore?.host, "127.0.0.1");
  assert.equal(emulatorConfig.emulators?.firestore?.port, 8080);
  assert.equal(emulatorConfig.hosting, undefined);
  assert.equal(emulatorConfig.functions, undefined);
});

test("baseline Firestore rules deny every read and write", () => {
  assert.match(rules, /rules_version\s*=\s*'2'/);
  assert.match(rules, /match\s+\/\{document=\*\*\}/);
  assert.match(rules, /allow\s+read,\s*write:\s*if\s+false\s*;/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|create|update|delete)\s*:\s*if\s+true/);
});

test("baseline rules contain no application-specific allow exceptions", () => {
  assert.equal((rules.match(/\ballow\b/g) ?? []).length, 1);
});
