// Pure, synthetic-only upload abuse and cleanup policy model.
// Trusted backend must derive uid, timestamps, ownership and storage facts.
// This module performs no I/O, Firebase calls, network access or credential reads.

export const UPLOAD_GUARDS = Object.freeze({
  product: Object.freeze({ maxFiles: 6, maxBytesPerFile: 5 * 1024 * 1024, maxBytesPerWindow: 30 * 1024 * 1024, maxGrantsPerHour: 12 }),
  store: Object.freeze({ maxFiles: 1, maxBytesPerFile: 5 * 1024 * 1024, maxBytesPerWindow: 5 * 1024 * 1024, maxGrantsPerHour: 4 }),
  profile: Object.freeze({ maxFiles: 1, maxBytesPerFile: 2 * 1024 * 1024, maxBytesPerWindow: 2 * 1024 * 1024, maxGrantsPerHour: 4 }),
  chat: Object.freeze({ maxFiles: 1, maxBytesPerFile: 3 * 1024 * 1024, maxBytesPerWindow: 9 * 1024 * 1024, maxGrantsPerHour: 12 })
});

const HOUR_MS = 60 * 60 * 1000;
const CLEANUP_GRACE_MS = 24 * HOUR_MS;

export function evaluateUploadRequest(request, history = [], now = Date.now()) {
  if (!request || typeof request !== 'object' || typeof request.uid !== 'string' || !request.uid.trim()) {
    return { allowed: false, reason: 'authenticated_owner_required' };
  }
  const policy = UPLOAD_GUARDS[request.surface];
  if (!policy) return { allowed: false, reason: 'unknown_surface' };
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(request.bytes) || request.bytes <= 0 || !Array.isArray(history)) {
    return { allowed: false, reason: 'invalid_request' };
  }
  if (request.bytes > policy.maxBytesPerFile) return { allowed: false, reason: 'file_size_exceeded' };
  if (!Number.isInteger(request.fileCount) || request.fileCount < 1 || request.fileCount > policy.maxFiles) {
    return { allowed: false, reason: 'file_count_exceeded' };
  }
  const recent = history.filter(item => item && item.uid === request.uid &&
    item.surface === request.surface && Number.isFinite(item.createdAt) &&
    item.createdAt > now - HOUR_MS && item.createdAt <= now);
  if (recent.length >= policy.maxGrantsPerHour) return { allowed: false, reason: 'grant_rate_exceeded' };
  const usedBytes = recent.reduce((sum, item) => sum + (Number.isSafeInteger(item.bytes) && item.bytes > 0 ? item.bytes : 0), 0);
  const requestedBytes = request.bytes * request.fileCount;
  if (!Number.isSafeInteger(usedBytes) || !Number.isSafeInteger(requestedBytes) || usedBytes + requestedBytes > policy.maxBytesPerWindow) return { allowed: false, reason: 'hourly_byte_quota_exceeded' };
  return { allowed: true, reason: 'policy_eligible', expiresInSeconds: 120 };
}

// Candidate selection only. A trusted cleanup worker must re-check storage and DB state
// immediately before deletion. Approved, referenced, published and non-quarantine objects
// are never candidates. Repeated runs produce the same candidates (idempotent selection).
export function selectCleanupCandidates(objects, now = Date.now()) {
  if (!Array.isArray(objects) || !Number.isFinite(now)) return [];
  return objects.filter(item => {
    if (!item || typeof item.objectId !== 'string' || !item.objectId.trim()) return false;
    if (!['quarantined', 'orphaned', 'rejected'].includes(item.status)) return false;
    if (item.approved !== false || item.referenced !== false || item.published !== false) return false;
    if (!Number.isFinite(item.createdAt) || item.createdAt > now - CLEANUP_GRACE_MS) return false;
    return true;
  }).filter((item, index, all) => all.findIndex(candidate => candidate.objectId === item.objectId) === index)
    .slice(0, CLEANUP_POLICY.batchLimit).map(item => ({ objectId: item.objectId, reason: item.status }));
}

export const CLEANUP_POLICY = Object.freeze({
  gracePeriodHours: 24,
  batchLimit: 100,
  requireRecheckBeforeDelete: true,
  deleteOperationMustBeIdempotent: true,
  neverLogSignedUrlsOrFilePayloads: true
});
