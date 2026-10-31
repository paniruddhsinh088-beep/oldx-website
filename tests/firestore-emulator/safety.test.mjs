import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(
  await readFile(new URL("../../firebase.json", import.meta.url), "utf8")
);

test("Firestore Emulator is bound to loopback only", () => {
  assert.equal(config.emulators?.firestore?.host, "127.0.0.1");
});

test("Firestore Emulator uses the documented local port", () => {
  assert.equal(config.emulators?.firestore?.port, 8080);
});

test("Emulator config does not enable Hosting or Functions", () => {
  assert.equal(config.emulators?.hosting, undefined);
  assert.equal(config.emulators?.functions, undefined);
});

test("Emulator config does not declare a live Firebase project", () => {
  const serialized = JSON.stringify(config);
  assert.equal(serialized.includes("oldx-1c983"), false);
  assert.equal(serialized.includes("oldx-staging"), false);
});

test("Emulator-only setup does not contain a deploy configuration", () => {
  assert.equal(config.hosting, undefined);
  assert.equal(config.functions, undefined);
});
