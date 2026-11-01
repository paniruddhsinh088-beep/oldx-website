import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectProviderPreviewDraft } from './preview-draft.mjs';

const draft = { displayName: 'કિરણભાઈ', city: 'અમદાવાદ', serviceArea: 'બોપલ',
  services: ['ફર્નિચર રિપેર', 'પ્લમ્બર'], experienceYears: '', description: '',
  available: true, phoneConsent: false, whatsappConsent: false };

test('valid local draft uses the shared profile normalizer and optional defaults', () => {
  const source = structuredClone(draft);
  const result = inspectProviderPreviewDraft(source);
  assert.equal(result.ok, true);
  assert.equal(result.completed, 4);
  assert.equal(result.profile.experienceYears, null);
  assert.deepEqual(result.consent, { phone: false, whatsapp: false });
  result.profile.services.push('Painter');
  assert.deepEqual(source, draft);
});

test('reports every invalid required field without inventing a completed profile', () => {
  const result = inspectProviderPreviewDraft({ ...draft, displayName: ' ', city: '', serviceArea: '', services: [] });
  assert.equal(result.ok, false);
  assert.equal(result.completed, 0);
  assert.deepEqual(Object.keys(result.errors), ['displayName', 'city', 'serviceArea', 'services']);
  assert.equal(Object.hasOwn(result, 'profile'), false);
});

test('rejects fractional, out-of-range and non-numeric experience without coercing it to zero', () => {
  for (const value of ['1.5', '81', 'abc', ' ', null, true, -1, Infinity]) {
    assert.equal(inspectProviderPreviewDraft({ ...draft, experienceYears: value }).errors.experienceYears, 'INVALID_EXPERIENCE');
  }
  assert.equal(inspectProviderPreviewDraft({ ...draft, experienceYears: '0' }).profile.experienceYears, 0);
  assert.equal(inspectProviderPreviewDraft({ ...draft, experienceYears: '80' }).profile.experienceYears, 80);
});

test('keeps contact choices independent and never copies privileged or private extras', () => {
  const result = inspectProviderPreviewDraft({ ...draft, phoneConsent: true, whatsappConsent: false, ownerUid: 'private', status: 'active' });
  assert.deepEqual(result.consent, { phone: true, whatsapp: false });
  assert.equal(Object.hasOwn(result.profile, 'ownerUid'), false);
  assert.equal(Object.hasOwn(result.profile, 'status'), false);
  assert.equal(inspectProviderPreviewDraft({ ...draft, whatsappConsent: 'true' }).ok, false);
});

test('rejects markup, control characters, duplicate services and oversized optional fields', () => {
  for (const patch of [{ displayName: '<img>' }, { services: ['Plumber', 'plumber'] },
    { description: '\n<script>' }, { description: 'x'.repeat(1201) }, { city: 'City\u0000' }]) {
    assert.equal(inspectProviderPreviewDraft({ ...draft, ...patch }).ok, false);
  }
});
