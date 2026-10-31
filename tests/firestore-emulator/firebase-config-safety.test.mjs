import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const generator = await readFile(new URL("scripts/generate-firebase-env.js", root), "utf8");
const gitignore = await readFile(new URL(".gitignore", root), "utf8");
const example = await readFile(new URL("firebase-env.example.js", root), "utf8");

test("browser config generator uses an explicit environment allowlist", () => {
  assert.match(generator, /OLDX_FIREBASE_ENV/);
  assert.match(generator, /staging:\s*"oldx-staging"/);
  assert.match(generator, /production:\s*"oldx-1c983"/);
  assert.match(generator, /fields\.projectId !== expectedProjects\[environment\]/);
});

test("browser config generator emits only the six public Firebase web config fields", () => {
  for (const field of [
    "apiKey", "authDomain", "projectId",
    "storageBucket", "messagingSenderId", "appId"
  ]) {
    assert.match(generator, new RegExp("\\b" + field + "\\s*:"));
  }
  assert.match(generator, /Object\.freeze/);
  assert.match(generator, /window\.OLDX_FIREBASE_CONFIG/);
  assert.doesNotMatch(generator, /serviceAccount|privateKey|clientEmail|FIREBASE_ADMIN|CLOUDINARY_API_SECRET/i);
});

test("generated firebase-env.js is excluded from Git", () => {
  assert.match(gitignore, /^\/firebase-env\.js$/m);
});

test("example config explicitly warns against placing server credentials in browser config", () => {
  assert.match(example, /not a place for service-account keys/i);
  assert.match(example, /REPLACE_FROM_FIREBASE_WEB_APP_CONFIG/);
  assert.doesNotMatch(example, /-----BEGIN PRIVATE KEY-----/);
});
