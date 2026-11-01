import test from "node:test";
import assert from "node:assert/strict";
import {
  bindDeletionSubject,
  validateDeletionPage,
  evaluateDeletionProgress,
  isDeletionRetryIdempotent
} from "../../scripts/account-deletion-policy.mjs";

test("deletion subject is always bound to authenticated UID", () => {
  assert.deepEqual(bindDeletionSubject("synthetic-user"), { ok: true, uid: "synthetic-user" });
  assert.equal(bindDeletionSubject("synthetic-user", "attacker").error, "subject_mismatch");
  assert.equal(bindDeletionSubject("", "synthetic-user").error, "unauthenticated");
});

test("deletion page and cursor are bounded", () => {
  assert.equal(validateDeletionPage().pageSize, 20);
  assert.equal(validateDeletionPage({ pageSize: 101 }).ok, false);
  assert.equal(validateDeletionPage({ pageSize: 0 }).ok, false);
  assert.equal(validateDeletionPage({ cursor: "../unsafe" }).ok, false);
  assert.equal(validateDeletionPage({ pageSize: 50, cursor: "checkpoint_01" }).ok, true);
});

test("job cannot complete while mandatory cleanup remains", () => {
  const result = evaluateDeletionProgress({
    state: "completed", mandatorySteps: ["products", "chats", "retention_reviewed"],
    completedSteps: ["products", "chats"]
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "cleanup_incomplete");
  assert.deepEqual(result.missing, ["retention_reviewed"]);
});

test("provider failure prevents completion and remains retryable", () => {
  const result = evaluateDeletionProgress({
    state: "processing", mandatorySteps: ["products", "images"],
    completedSteps: ["products"], failedSteps: ["images"]
  });
  assert.equal(result.ok, true);
  assert.equal(result.canComplete, false);
  assert.equal(result.state, "failed_retryable");
});

test("completed with retention requires explicit retention review", () => {
  assert.equal(evaluateDeletionProgress({
    state: "completed_with_retention", mandatorySteps: ["products"],
    completedSteps: ["products"]
  }).error, "retention_not_reviewed");
  assert.equal(evaluateDeletionProgress({
    state: "completed_with_retention", mandatorySteps: ["products"],
    completedSteps: ["products", "retention_reviewed"]
  }).canComplete, true);
});

test("duplicate deletion request key is idempotent", () => {
  assert.equal(isDeletionRetryIdempotent("request_01", "request_01"), true);
  assert.equal(isDeletionRetryIdempotent("request_01", "request_02"), false);
  assert.equal(isDeletionRetryIdempotent("", ""), false);
});

test("unknown state and malformed job fail closed", () => {
  assert.equal(evaluateDeletionProgress({
    state: "delete_now", mandatorySteps: ["products"], completedSteps: []
  }).ok, false);
  assert.equal(evaluateDeletionProgress({
    state: "processing", mandatorySteps: [], completedSteps: []
  }).ok, false);
});
