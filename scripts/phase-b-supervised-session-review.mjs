#!/usr/bin/env node
/**
 * OLDX Phase B: OFFLINE review of the exact 4-resource create/verify/cleanup contract.
 *
 * Intentionally NO network calls, credentials, writes, deletes, SDK imports or
 * live execution option. Running this never provisions cloud fixtures.
 *
 * Usage: node scripts/phase-b-supervised-session-review.mjs
 */
import assert from 'node:assert/strict';

const PROJECT = 'oldx-staging';
const DATABASE = '(default)';
const OPERATOR = 'yasminparmar087@gmail.com';
const AUTH_UIDS = Object.freeze(['synthetic-seller-a', 'synthetic-buyer-b']);
const DOCS = Object.freeze([
  'marketplaceActors_v1/synthetic-seller-a',
  'marketplacePrivate_v1/product_synthetic-phase-b-read-01',
]);

function mustBeExact(value, expected, label) {
  assert.equal(value, expected, label + ': mismatch, fail closed');
}

mustBeExact(PROJECT, 'oldx-staging', 'project');
mustBeExact(DATABASE, '(default)', 'database');
mustBeExact(OPERATOR, 'yasminparmar087@gmail.com', 'operator');
assert.deepEqual(AUTH_UIDS, ['synthetic-seller-a', 'synthetic-buyer-b']);
assert.deepEqual(DOCS, [
  'marketplaceActors_v1/synthetic-seller-a',
  'marketplacePrivate_v1/product_synthetic-phase-b-read-01',
]);
assert.equal(new Set([...AUTH_UIDS, ...DOCS]).size, 4);
for (const path of DOCS) {
  assert.match(path, /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/);
}
const phases = Object.freeze([
  '1. Confirm operator, project, supervised window and proven cleanup path',
  '2. Fresh exact-UID Auth lookups and exact-document Firestore GETs: all absent',
  '3. Show full executable write and cleanup commands for owner pre-run approval',
  '4. Create ONLY both exact Auth UIDs using admin-authorized REST (no idToken)',
  '5. Create ONLY both exact Firestore docs via createDocument + documentId',
  '6. Verify exact IDs, creation evidence, nonsecret provenance and timestamps',
  '7. Run ONLY independently approved tests; Owner Read remains default-off',
  '8. Fresh GET and provenance check; Firestore conditional delete by updateTime',
  '9. Exact-UID Auth delete only after verifying the current UID and inventory',
  '10. Verify all four absent; record redacted evidence or report residuals',
]);
const hardStops = Object.freeze([
  'No owner-approved supervised same-day cleanup window',
  'No proved, reviewable exact-UID Auth deletion method or mismatch in UID',
  'No approved creation payload, unsafe credentials or any exposed secret',
  'Any resource exists at preflight; any other user/document is involved',
  'Auth API ambiguity, unknown HTTP response, timeout after a possible write',
  'Firestore provenance or updateTime mismatch before conditional deletion',
  'Missing separate permission for live Owner Read or quota-counter writes',
]);
console.log('OLDX PHASE B — OFFLINE CONTRACT REVIEW ONLY');
console.log('PROJECT:', PROJECT, '| DB:', DATABASE);
console.log('EXACT AUTH UIDS:', AUTH_UIDS.join(', '));
console.log('EXACT FIRESTORE PATHS:', DOCS.join(', '));
console.log('\nSESSION PLAN');
for (const p of phases) console.log(p);
console.log('\nHARD STOP CONDITIONS');
for (const stop of hardStops) console.log('- ' + stop);
console.log('\nRESULT: OFFLINE CONTRACT VALID; NO CLOUD REQUESTS; NO FIXTURES CREATED.');
console.log('EXECUTION STATUS: BLOCKED until owner review + verified cleanup.');
