import test from "node:test";
import assert from "node:assert/strict";
import {
  bindRequestOwner,
  validateDataRequest,
  transitionDataRequest,
  evaluateExportReadiness,
  canExposeExportReference,
  deletionCanComplete,
  isRequestRetryDuplicate,
} from "../../scripts/data-request-policy.mjs";

test("request owner is always derived from verified identity", () => {
  assert.deepEqual(bindRequestOwner("user_A"), { ok: true, uid: "user_A" });
  assert.equal(bindRequestOwner("user_A", "user_B").code, "FORBIDDEN");
  assert.equal(bindRequestOwner("", "user_A").code, "UNAUTHENTICATED");
});

test("only export or deletion requests with opaque idempotency keys are accepted", () => {
  const key = "synthetic_idempotency_001";
  assert.deepEqual(validateDataRequest({ type: "export", idempotencyKey: key }), {
    ok: true, type: "export", idempotencyKey: key,
  });
  for (const input of [
    null, {}, { type: "admin", idempotencyKey: key },
    { type: "deletion", idempotencyKey: "short" },
    { type: "export", idempotencyKey: key, uid: "victim" },
    { type: "export", idempotencyKey: key, requestedAt: "client-time" },
  ]) assert.equal(validateDataRequest(input).ok, false);
});

test("request lifecycle permits only explicit safe transitions", () => {
  assert.deepEqual(transitionDataRequest("received", "processing"), {
    ok: true, state: "processing",
  });
  assert.equal(transitionDataRequest("completed", "processing").code, "INVALID_TRANSITION");
  assert.equal(transitionDataRequest("unknown", "completed").ok, false);
});

test("export is not ready until all privacy and completeness gates pass", () => {
  const base = {
    ownerMatches: true, allPagesComplete: true, privateMediaResolved: true,
    sharedDataRedacted: true, retentionReviewed: true, expiresAt: 2000, now: 1000,
  };
  assert.deepEqual(evaluateExportReadiness(base), { ok: true });
  for (const key of ["ownerMatches", "allPagesComplete", "privateMediaResolved",
    "sharedDataRedacted", "retentionReviewed"]) {
    assert.equal(evaluateExportReadiness({ ...base, [key]: false }).code, "EXPORT_NOT_READY");
  }
  assert.equal(evaluateExportReadiness({ ...base, expiresAt: 1000 }).ok, false);
});

test("export reference is private, owner-bound, completed, and unexpired", () => {
  const base = { ownerMatches: true, status: "completed", expiresAt: 3000,
    now: 2000, reference: "opaque-reference-123456" };
  assert.equal(canExposeExportReference(base), true);
  assert.equal(canExposeExportReference({ ...base, ownerMatches: false }), false);
  assert.equal(canExposeExportReference({ ...base, status: "processing" }), false);
  assert.equal(canExposeExportReference({ ...base, expiresAt: 2000 }), false);
  assert.equal(canExposeExportReference({ ...base, reference: "tiny" }), false);
});

test("deletion cannot complete with unresolved shared data or external media", () => {
  const base = {
    mandatorySteps: ["userData", "ownedListings", "chatPrivacy", "mediaScan"],
    completedSteps: ["userData", "ownedListings", "chatPrivacy", "mediaScan"],
    unresolvedSharedData: false, externalMediaPending: false,
    retentionExceptionReviewed: true,
  };
  assert.equal(deletionCanComplete(base).canComplete, true);
  assert.equal(deletionCanComplete({ ...base, unresolvedSharedData: true }).canComplete, false);
  assert.equal(deletionCanComplete({ ...base, externalMediaPending: true }).canComplete, false);
  assert.equal(deletionCanComplete({ ...base, retentionExceptionReviewed: false }).canComplete, false);
  assert.equal(deletionCanComplete({ ...base, completedSteps: ["userData"] }).canComplete, false);
});

test("duplicate request retries are detected without storing raw request keys", () => {
  assert.equal(isRequestRetryDuplicate("hash_A", "hash_A"), true);
  assert.equal(isRequestRetryDuplicate("hash_A", "hash_B"), false);
  assert.equal(isRequestRetryDuplicate("", ""), false);
});
