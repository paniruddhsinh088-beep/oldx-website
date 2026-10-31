import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootConfig = JSON.parse(
  await readFile(new URL("../../firebase.json", import.meta.url), "utf8")
);
const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8")
);
const workflow = await readFile(
  new URL("../../.github/workflows/oldx-review-safety.yml", import.meta.url),
  "utf8"
);

test("root Firebase config does not load candidate Firestore Rules", () => {
  assert.equal(rootConfig.firestore, undefined);
});

test("normal npm scripts expose no Firebase or Vercel deployment command", () => {
  const scripts = Object.values(packageJson.scripts ?? {}).join("\n");
  assert.doesNotMatch(scripts, /firebase\s+deploy|vercel\s+deploy|gcloud\s+deploy/i);
});

test("review CI runs tests only and has read-only repository permissions", () => {
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(workflow, /npm run test:emulator:safety/);
  assert.doesNotMatch(workflow, /firebase\s+deploy|vercel\s+deploy|gcloud\s+deploy/i);
});
