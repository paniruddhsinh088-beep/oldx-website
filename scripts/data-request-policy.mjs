const TYPES = new Set(["export", "deletion"]);
const STATES = new Set(["received", "processing", "waitingReview", "blocked", "completed", "failedRetryable"]);
const TERMINAL = new Set(["completed"]);
const TRANSITIONS = Object.freeze({
  received: new Set(["processing", "waitingReview", "blocked", "failedRetryable"]),
  processing: new Set(["waitingReview", "blocked", "completed", "failedRetryable"]),
  waitingReview: new Set(["processing", "blocked", "failedRetryable"]),
  blocked: new Set(["processing", "failedRetryable"]),
  failedRetryable: new Set(["processing", "blocked"]),
  completed: new Set(),
});

export function bindRequestOwner(verifiedUid, requestedUid) {
  if (typeof verifiedUid !== "string" || verifiedUid.length === 0) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }
  if (requestedUid !== undefined && requestedUid !== verifiedUid) {
    return { ok: false, code: "FORBIDDEN" };
  }
  return { ok: true, uid: verifiedUid };
}

export function validateDataRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !TYPES.has(input.type) ||
      typeof input.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  const keys = Object.keys(input);
  if (keys.some(key => !["type", "idempotencyKey", "requestedAt"].includes(key))) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  if (input.requestedAt !== undefined) return { ok: false, code: "VALIDATION_FAILED" };
  return { ok: true, type: input.type, idempotencyKey: input.idempotencyKey };
}

export function transitionDataRequest(currentState, nextState) {
  if (!STATES.has(currentState) || !STATES.has(nextState)) {
    return { ok: false, code: "INVALID_STATE" };
  }
  if (!TRANSITIONS[currentState].has(nextState)) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }
  return { ok: true, state: nextState };
}

export function evaluateExportReadiness({
  ownerMatches,
  allPagesComplete,
  privateMediaResolved,
  sharedDataRedacted,
  retentionReviewed,
  expiresAt,
  now,
}) {
  const checks = [ownerMatches, allPagesComplete, privateMediaResolved,
    sharedDataRedacted, retentionReviewed];
  if (checks.some(value => typeof value !== "boolean") ||
      !Number.isFinite(expiresAt) || !Number.isFinite(now)) {
    return { ok: false, code: "INVALID_EXPORT_STATE" };
  }
  if (checks.some(value => value !== true) || expiresAt <= now) {
    return { ok: false, code: "EXPORT_NOT_READY" };
  }
  return { ok: true };
}

export function canExposeExportReference({ ownerMatches, status, expiresAt, now, reference }) {
  if (ownerMatches !== true || status !== "completed" ||
      !Number.isFinite(expiresAt) || !Number.isFinite(now) ||
      expiresAt <= now || typeof reference !== "string" ||
      reference.length < 16 || reference.length > 512) return false;
  return true;
}

export function deletionCanComplete({
  mandatorySteps,
  completedSteps,
  unresolvedSharedData,
  externalMediaPending,
  retentionExceptionReviewed,
}) {
  if (!Array.isArray(mandatorySteps) || mandatorySteps.length === 0 ||
      !Array.isArray(completedSteps) ||
      typeof unresolvedSharedData !== "boolean" ||
      typeof externalMediaPending !== "boolean" ||
      typeof retentionExceptionReviewed !== "boolean") {
    return { ok: false, code: "INVALID_DELETION_STATE" };
  }
  const missing = mandatorySteps.filter(step =>
    typeof step !== "string" || !completedSteps.includes(step)
  );
  if (missing.length || unresolvedSharedData || externalMediaPending ||
      !retentionExceptionReviewed) {
    return { ok: true, canComplete: false, missing,
      code: "CLEANUP_OR_REVIEW_PENDING" };
  }
  return { ok: true, canComplete: true };
}

export function isRequestRetryDuplicate(existingKeyHash, incomingKeyHash) {
  return typeof existingKeyHash === "string" && existingKeyHash.length > 0 &&
    existingKeyHash === incomingKeyHash;
}
