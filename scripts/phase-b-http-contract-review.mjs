#!/usr/bin/env node
/**
 * OLDX Phase B exact-request CONTRACT REVIEW. Completely offline by design.
 * No network imports, token readers, HTTP calls, credentials or live mutations.
 * This script deliberately cannot be toggled into execution mode.
 */
import assert from 'node:assert/strict';

export const project = 'oldx-staging';
export const database = '(default)';
export const authUids = Object.freeze(['synthetic-seller-a', 'synthetic-buyer-b']);
export const firestoreDocs = Object.freeze([
  'marketplaceActors_v1/synthetic-seller-a',
  'marketplacePrivate_v1/product_synthetic-phase-b-read-01',
]);
const authBase = `https://identitytoolkit.googleapis.com/v1/projects/${project}`;
const fsBase = `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(database)}/documents`;
const fsUrl = (path) => `${fsBase}/${path.split('/').map(encodeURIComponent).join('/')}`;

export function buildContract() {
  assert.equal(project, 'oldx-staging');
  assert.equal(database, '(default)');
  assert.deepEqual(authUids, ['synthetic-seller-a', 'synthetic-buyer-b']);
  assert.deepEqual(firestoreDocs, [
    'marketplaceActors_v1/synthetic-seller-a',
    'marketplacePrivate_v1/product_synthetic-phase-b-read-01',
  ]);
  const actions = [];
  for (const uid of authUids) {
    actions.push({ stage: 'preflight/auth', method: 'POST', url: `${authBase}/accounts:lookup`,
      bodyKeys: ['localId'], bodyExample: { localId: [uid] }, mutation: false });
  }
  for (const path of firestoreDocs) {
    actions.push({ stage: 'preflight/firestore', method: 'GET', url: fsUrl(path),
      bodyKeys: [], mutation: false });
  }
  for (const uid of authUids) {
    actions.push({ stage: 'create/auth', method: 'POST', url: `${authBase}/accounts?key=<STAGING_API_KEY_IN_MEMORY>`,
      bodyKeys: ['localId', 'email', 'password', 'emailVerified'],
      bodyExample: { localId: uid, email: '<EPHEMERAL_SYNTHETIC_EMAIL>', password: '<IN_MEMORY_ONLY>', emailVerified: false }, mutation: true });
  }
  for (const path of firestoreDocs) {
    const [collection, docId] = path.split('/');
    actions.push({ stage: 'create/firestore', method: 'POST',
      url: `${fsBase}/${encodeURIComponent(collection)}?documentId=${encodeURIComponent(docId)}`,
      bodyKeys: ['fields'], bodyExample: { fields: '<SCHEMA_REVIEW_REQUIRED>' }, mutation: true });
  }
  for (const path of firestoreDocs) {
    actions.push({ stage: 'cleanup/firestore', method: 'POST',
      url: fsBase + ':commit', bodyKeys: ['writes'],
      bodyExample: {writes: [{delete: `projects/${project}/databases/${database}/documents/${path}`,
        currentDocument: {updateTime: '<ORIGINAL_VERIFIED_UPDATE_TIME>'}}]}, mutation: true });
  }
  for (const uid of authUids) {
    actions.push({ stage: 'cleanup/auth', method: 'POST', url: `${authBase}/accounts:delete`,
      bodyKeys: ['localId'], bodyExample: { localId: uid }, mutation: true });
  }
  return actions;
}

export function validateContract(steps) {
  assert.equal(steps.length, 12, 'exactly 4 preflight + 4 creates + 4 cleanup');
  assert.deepEqual(steps.reduce((m, s) => (m[s.stage] = (m[s.stage] ?? 0) + 1, m), {}), {
    'preflight/auth': 2, 'preflight/firestore': 2, 'create/auth': 2,
    'create/firestore': 2, 'cleanup/firestore': 2, 'cleanup/auth': 2,
  });
  for (const s of steps) {
    assert.match(s.url, /oldx-staging/);
    assert.equal(s.url.includes('oldx-1c983'), false);
    assert.equal(/<IN_MEMORY_ONLY>|<SCHEMA_REVIEW_REQUIRED>/.test(JSON.stringify(s)), true === (s.stage === 'create/auth' || s.stage === 'create/firestore'));
    if (s.stage === 'create/firestore') assert.match(s.url, /\?documentId=/);
  }
  const cleanup = steps.filter((step) => step.stage === 'cleanup/firestore');
  for (const [index, path] of firestoreDocs.entries()) {
    assert.equal(cleanup[index].method, 'POST');
    assert.equal(cleanup[index].url, fsBase + ':commit');
    assert.deepEqual(cleanup[index].bodyExample, {writes: [{
      delete: `projects/${project}/databases/${database}/documents/${path}`,
      currentDocument: {updateTime: '<ORIGINAL_VERIFIED_UPDATE_TIME>'},
    }]});
  }
  return true;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const steps = buildContract();
  validateContract(steps);
  console.log('OLDX PHASE B — HTTP CONTRACT PREVIEW (OFFLINE ONLY)');
  console.log('All HTTP mutations are DESCRIPTIONS ONLY, never executed.');
  for (const [i, s] of steps.entries()) {
    console.log(`${i + 1}. [${s.stage}] ${s.method} ${s.url}`);
    console.log(`   body keys: ${s.bodyKeys.join(', ') || '(none)'}`);
  }
  console.log('UNRESOLVED: Auth create/delete success, Firestore schema, secret hygiene, supervised cleanup window.');
  console.log('RESULT: OFFLINE CONTRACT VERIFIED; ZERO CLOUD REQUESTS; WRITES BLOCKED.');
}
