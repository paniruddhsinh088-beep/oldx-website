import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicProviderProfile } from './provider-public-profile.mjs';

const valid = { id: 'p1', displayName: 'કિરણભાઈ', city: 'અમદાવાદ', serviceArea: 'બોપલ',
  services: ['સુથાર', 'ફર્નિચર રિપેર'], available: true, experienceYears: 7,
  description: 'ઘર અને ઓફિસમાં કામ', languages: ['gu', 'hi'] };

test('projects only public profile fields and retains multiple authored services', () => {
  const input = { ...valid, phone: 'private-phone', ownerUid: 'private-owner', email: 'private-email',
    exactLocation: { lat: 1 }, moderationNotes: 'private-note', verified: true, rating: 5 };
  const result = buildPublicProviderProfile(input);
  assert.deepEqual(result, { ok: true, profile: valid });
  assert.deepEqual(Object.keys(result.profile).sort(), Object.keys(valid).sort());
  result.profile.services.push('Painter'); result.profile.languages.push('en');
  assert.deepEqual(input.services, valid.services);
  assert.deepEqual(input.languages, valid.languages);
});

test('rejects unsafe route IDs, sparse/duplicate services and malformed profile text', () => {
  for (const patch of [{ id: '../private' }, { id: ' p1 ' }, { displayName: 'Name\u0085hidden' }, { id: 'a'.repeat(101) }, { description: '<img>' },
    { description: 'a'.repeat(1201) }, { description: '\u0085' }, { services: Array(2) },
    { services: ['Plumber', ' plumber '] }, { languages: ['gu', 'gu'] },
    { languages: Array(1) }, { languages: ['fr'] }, { experienceYears: -1 }]) {
    assert.equal(buildPublicProviderProfile({ ...valid, ...patch }).ok, false);
  }
  assert.equal(buildPublicProviderProfile(Object.create(valid)).ok, false);
});

test('optional public description/languages default safely without disclosure of extra fields', () => {
  const { description, languages, ...minimal } = valid;
  const result = buildPublicProviderProfile({ ...minimal, contactConsent: { phone: true } });
  assert.equal(result.ok, true);
  assert.equal(result.profile.description, '');
  assert.deepEqual(result.profile.languages, []);
  assert.equal(Object.hasOwn(result.profile, 'contactConsent'), false);
});
