import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContract, validateContract, authUids, firestoreDocs } from '../../scripts/phase-b-http-contract-review.mjs';

test('uses exact four synthetic resources and twelve request descriptions', () => {
  assert.deepEqual(authUids, ['synthetic-seller-a', 'synthetic-buyer-b']);
  assert.equal(firestoreDocs.length, 2);
  assert.equal(validateContract(buildContract()), true);
});

test('Firestore writes are create-only and deletion requires an updateTime guard', () => {
  const steps = buildContract();
  assert.equal(steps.filter(s => s.stage === 'create/firestore' && s.url.includes('?documentId=')).length, 2);
  assert.equal(steps.filter(s => s.stage === 'cleanup/firestore' && s.url.includes('currentDocument.updateTime=')).length, 2);
  assert.equal(steps.some(s => s.method === 'PATCH' || s.url.includes(':batchDelete')), false);
});

test('no live credentials or secrets in preview descriptions', () => {
  const data = JSON.stringify(buildContract());
  assert.equal(data.includes('Bearer '), false);
  assert.equal(data.includes('ya29.'), false);
  assert.equal(data.includes('AIza'), false);
  assert.equal(data.includes('gmail.com'), false);
});
