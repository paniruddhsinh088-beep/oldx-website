const STATES = new Set(["requested", "restricted", "processing", "awaiting_provider", "failed_retryable", "completed", "completed_with_retention"]);
const TERMINAL = new Set(["completed", "completed_with_retention"]);

export function bindDeletionSubject(authenticatedUid, requestedUid) {
  if (typeof authenticatedUid !== "string" || !authenticatedUid) return { ok: false, error: "unauthenticated" };
  if (requestedUid !== undefined && requestedUid !== authenticatedUid) return { ok: false, error: "subject_mismatch" };
  return { ok: true, uid: authenticatedUid };
}

export function validateDeletionPage({ pageSize = 20, cursor = null } = {}) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) return { ok: false, error: "invalid_page_size" };
  if (cursor !== null && (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(cursor))) {
    return { ok: false, error: "invalid_cursor" };
  }
  return { ok: true, pageSize, cursor };
}

export function evaluateDeletionProgress({ state, mandatorySteps, completedSteps, failedSteps = [] }) {
  if (!STATES.has(state) || !Array.isArray(mandatorySteps) || mandatorySteps.length === 0 ||
      !Array.isArray(completedSteps) || !Array.isArray(failedSteps)) {
    return { ok: false, error: "invalid_job_state" };
  }
  if (mandatorySteps.some(step => typeof step !== "string" || !step) ||
      completedSteps.some(step => typeof step !== "string") ||
      failedSteps.some(step => typeof step !== "string")) return { ok: false, error: "invalid_step" };
  const missing = mandatorySteps.filter(step => !completedSteps.includes(step));
  if (TERMINAL.has(state) && (missing.length || failedSteps.length)) {
    return { ok: false, error: "cleanup_incomplete", missing };
  }
  if (state === "completed_with_retention" && !completedSteps.includes("retention_reviewed")) {
    return { ok: false, error: "retention_not_reviewed", missing };
  }
  if (failedSteps.length) return { ok: true, canComplete: false, state: "failed_retryable", missing, failedSteps };
  return { ok: true, canComplete: missing.length === 0, missing };
}

export function isDeletionRetryIdempotent(existingRequestKey, incomingRequestKey) {
  return typeof existingRequestKey === "string" && existingRequestKey.length > 0 &&
    existingRequestKey === incomingRequestKey;
}
