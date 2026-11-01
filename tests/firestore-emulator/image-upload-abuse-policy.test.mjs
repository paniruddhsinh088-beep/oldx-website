import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UPLOAD_GUARDS, CLEANUP_POLICY, evaluateUploadRequest, selectCleanupCandidates
} from '../../scripts/image-upload-abuse-policy.mjs';

const now = 2_000_000_000_000;

test('requires trusted authenticated owner identity', () => {
  assert.equal(evaluateUploadRequest({ surface: 'product', bytes: 100, fileCount: 1 }, [], now).reason, 'authenticated_owner_required');
});
test('rejects unknown surfaces and invalid sizes', () => {
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'other', bytes: 10, fileCount: 1 }, [], now).reason, 'unknown_surface');
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'product', bytes: 0, fileCount: 1 }, [], now).reason, 'invalid_request');
});
test('enforces per-file size and per-surface file-count caps', () => {
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'profile', bytes: 2 * 1024 * 1024 + 1, fileCount: 1 }, [], now).reason, 'file_size_exceeded');
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'store', bytes: 100, fileCount: 2 }, [], now).reason, 'file_count_exceeded');
});
test('allows request within the product policy and returns short grant lifetime', () => {
  const result = evaluateUploadRequest({ uid: 'u1', surface: 'product', bytes: 500_000, fileCount: 6 }, [], now);
  assert.deepEqual(result, { allowed: true, reason: 'policy_eligible', expiresInSeconds: 120 });
});
test('enforces per-user per-surface grant rate', () => {
  const history = Array.from({ length: UPLOAD_GUARDS.chat.maxGrantsPerHour }, (_, i) => ({
    uid: 'u1', surface: 'chat', bytes: 100, createdAt: now - i * 1000
  }));
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'chat', bytes: 100, fileCount: 1 }, history, now).reason, 'grant_rate_exceeded');
});
test('enforces hourly byte quota without mixing users or surfaces', () => {
  const history = [{ uid: 'u1', surface: 'profile', bytes: UPLOAD_GUARDS.profile.maxBytesPerWindow, createdAt: now - 1000 },
    { uid: 'u2', surface: 'profile', bytes: 999999, createdAt: now - 1000 }];
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'profile', bytes: 1, fileCount: 1 }, history, now).reason, 'hourly_byte_quota_exceeded');
});
test('ignores expired and future-dated grant history', () => {
  const history = [
    { uid: 'u1', surface: 'store', bytes: 1, createdAt: now - 3_600_001 },
    { uid: 'u1', surface: 'store', bytes: 1, createdAt: now + 1000 }
  ];
  assert.equal(evaluateUploadRequest({ uid: 'u1', surface: 'store', bytes: 100, fileCount: 1 }, history, now).allowed, true);
});
test('cleanup selects only old unreferenced quarantine, orphan and rejected objects', () => {
  const old = now - 25 * 60 * 60 * 1000;
  const items = [
    { objectId: 'q1', status: 'quarantined', createdAt: old },
    { objectId: 'o1', status: 'orphaned', createdAt: old },
    { objectId: 'r1', status: 'rejected', createdAt: old },
    { objectId: 'a1', status: 'approved', createdAt: old },
    { objectId: 'p1', status: 'quarantined', createdAt: old, published: true },
    { objectId: 'ref1', status: 'orphaned', createdAt: old, referenced: true },
    { objectId: 'new1', status: 'quarantined', createdAt: now - 1000 }
  ];
  assert.deepEqual(selectCleanupCandidates(items, now), [
    { objectId: 'q1', reason: 'quarantined' },
    { objectId: 'o1', reason: 'orphaned' },
    { objectId: 'r1', reason: 'rejected' }
  ]);
});
test('cleanup selection is deterministic and safe on malformed input', () => {
  const items = [{ objectId: 'x', status: 'orphaned', createdAt: now - 30 * 60 * 60 * 1000 }];
  assert.deepEqual(selectCleanupCandidates(items, now), selectCleanupCandidates(items, now));
  assert.deepEqual(selectCleanupCandidates(null, now), []);
});
test('cleanup policy requires a grace period, bounded batches and pre-delete recheck', () => {
  assert.equal(CLEANUP_POLICY.gracePeriodHours, 24);
  assert.equal(CLEANUP_POLICY.batchLimit, 100);
  assert.equal(CLEANUP_POLICY.requireRecheckBeforeDelete, true);
  assert.equal(CLEANUP_POLICY.deleteOperationMustBeIdempotent, true);
  assert.equal(CLEANUP_POLICY.neverLogSignedUrlsOrFilePayloads, true);
});
