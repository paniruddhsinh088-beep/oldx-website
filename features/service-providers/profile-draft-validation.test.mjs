import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderDraft } from './profile-draft-validation.mjs';
const valid = () => ({ displayName: 'Sample Carpenter', serviceIds: ['carpentry', 'painting'], cityId: 'ahmedabad', areaLabel: 'West', description: 'Repairs' });
test('accepts multiple distinct services', () => assert.equal(validateProviderDraft(valid()).valid, true));
test('rejects empty or duplicate services', () => {
  for (const ids of [[], ['painting', 'painting'], Array(9).fill('painting')]) {
    assert.equal(validateProviderDraft({ ...valid(), serviceIds: ids }).valid, false);
  }
});
test('rejects client-controlled privileged and contact fields', () => {
  for (const key of ['status', 'ownerUid', 'ratingSum', 'ratingCount', 'phoneE164', 'isAdmin']) {
    assert.equal(validateProviderDraft({ ...valid(), [key]: true }).valid, false);
  }
});
test('rejects invalid names and location identifiers', () => {
  assert.equal(validateProviderDraft({ ...valid(), displayName: ' ' }).valid, false);
  assert.equal(validateProviderDraft({ ...valid(), cityId: '../admin' }).valid, false);
});
