"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const script = path.resolve(__dirname, "generate-firebase-env.js");
const valid = {
  OLDX_FIREBASE_ENV: "staging",
  OLDX_FIREBASE_API_KEY: "synthetic-api-key",
  OLDX_FIREBASE_AUTH_DOMAIN: "oldx-staging.firebaseapp.com",
  OLDX_FIREBASE_PROJECT_ID: "oldx-staging",
  OLDX_FIREBASE_STORAGE_BUCKET: "oldx-staging.appspot.com",
  OLDX_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  OLDX_FIREBASE_APP_ID: "1:123456789:web:synthetic"
};

function run(envOverrides = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "oldx-firebase-env-"));
  const env = { ...process.env, ...valid, ...envOverrides };
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env,
    encoding: "utf8"
  });
  return { cwd, result, outputPath: path.join(cwd, "firebase-env.js") };
}

test("generates only the explicitly selected staging project config", () => {
  const { cwd, result, outputPath } = run();
  try {
    assert.equal(result.status, 0, result.stderr);
    const generated = fs.readFileSync(outputPath, "utf8");
    assert.match(generated, /environment":"staging"/);
    assert.match(generated, /projectId":"oldx-staging"/);
    assert.match(generated, /Object\.freeze/);
    assert.doesNotMatch(result.stdout, /synthetic-api-key/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("refuses missing environment selection and does not generate a file", () => {
  const { cwd, result, outputPath } = run({ OLDX_FIREBASE_ENV: "" });
  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OLDX_FIREBASE_ENV/);
    assert.equal(fs.existsSync(outputPath), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("refuses a production project selected as staging", () => {
  const { cwd, result, outputPath } = run({ OLDX_FIREBASE_PROJECT_ID: "oldx-1c983" });
  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match/);
    assert.equal(fs.existsSync(outputPath), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("refuses missing required Firebase web config", () => {
  const { cwd, result, outputPath } = run({ OLDX_FIREBASE_APP_ID: "" });
  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /appId/);
    assert.equal(fs.existsSync(outputPath), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});


test("refuses a Preview build configured for the production Firebase project", () => {
  const { cwd, result, outputPath } = run({
    VERCEL_ENV: "preview",
    OLDX_FIREBASE_ENV: "production",
    OLDX_FIREBASE_PROJECT_ID: "oldx-1c983"
  });
  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match VERCEL_ENV/);
    assert.equal(fs.existsSync(outputPath), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("refuses a Production build configured for the staging Firebase project", () => {
  const { cwd, result, outputPath } = run({
    VERCEL_ENV: "production",
    OLDX_FIREBASE_ENV: "staging",
    OLDX_FIREBASE_PROJECT_ID: "oldx-staging"
  });
  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match VERCEL_ENV/);
    assert.equal(fs.existsSync(outputPath), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
