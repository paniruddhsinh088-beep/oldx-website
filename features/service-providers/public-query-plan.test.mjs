import test from 'node:test';
import assert from 'node:assert/strict';
import { planPublicProviderQuery, PUBLIC_PROVIDER_QUERY_FIELDS } from './public-query-plan.mjs';
const enabled = { enabled: true };
const plan = (input, deps = enabled) => planPublicProviderQuery(input, deps);

test('disabled by default and never exposes private provider fields', () => {
  assert.equal(plan({ cityKey: 'surat' }).ok, true);
  assert.equal(planPublicProviderQuery({ cityKey: 'surat' }).ok, false);
  const result = plan({ serviceKey: 'carpenter', cityKey: 'ahmedabad', availableOnly: true, limit: 24 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.filters, {
    serviceKey: 'carpenter', cityKey: 'ahmedabad', availableOnly: true, publishedOnly: true
  });
  assert.equal(result.plan.publicOnly, true);
  assert.equal(result.plan.requiresTrustedRepository, true);
  assert.equal(result.plan.order, 'provider-id-ascending');
  assert.equal(result.plan.limit, 24);
  assert.deepEqual(result.plan.fields, PUBLIC_PROVIDER_QUERY_FIELDS);
  for (const field of ['phone', 'whatsapp', 'email', 'ownerUid', 'exactLocation', 'adminNotes', 'ip']) {
    assert.equal(result.plan.fields.includes(field), false);
  }
});

test('requires bounded indexed scope; rejects arbitrary text, private fields and invalid limits', () => {
  const invalid = [
    {}, { query: 'plumber', cityKey: 'surat' }, { ownerUid: 'x', cityKey: 'surat' },
    { serviceKey: '' }, { cityKey: ' ' }, { cityKey: 'surat', limit: 0 },
    { cityKey: 'surat', limit: 25 }, { cityKey: 'surat', limit: 1.5 },
    { cityKey: 'surat', availableOnly: 'true' },
    { cityKey: 'surat', serviceKey: '<script>' },
    { cityKey: 'surat', serviceKey: 'a\u202Eevil' },
    { cityKey: 'surat', cursor: 'unverified' },
    Object.create(null), [], null
  ];
  for (const item of invalid) assert.equal(plan(item).ok, false, JSON.stringify(item));
  assert.deepEqual(plan({ cityKey: 'surat' }).plan.filters, {
    serviceKey: '', cityKey: 'surat', availableOnly: false, publishedOnly: true
  });
});

test('canonicalizes Gujarati/Hindi/Latin keys without mutating caller data', () => {
  const input = { cityKey: 'અમદાવાદ', serviceKey: 'क़ारीगर' };
  const original = structuredClone(input);
  const result = plan(input);
  assert.equal(result.ok, true);
  assert.equal(result.plan.filters.cityKey, 'અમદાવાદ');
  assert.equal(result.plan.filters.serviceKey, 'क़ारीगर'.normalize('NFC'));
  assert.deepEqual(input, original);
  assert.equal(plan({ cityKey: 'Cafe\u0301' }).plan.filters.cityKey, 'café');
});

test('only a server-verified, same-scope cursor can advance the page', () => {
  const input = { serviceKey: 'plumber', cityKey: 'surat', cursor: 'token.123' };
  let checked = 0;
  const deps = { enabled: true, verifyCursor(token, scopeKey) {
    checked++;
    assert.equal(token, 'token.123');
    return { scopeKey, afterProviderId: 'provider_23' };
  } };
  const result = plan(input, deps);
  assert.equal(result.ok, true);
  assert.equal(result.plan.afterProviderId, 'provider_23');
  assert.equal(checked, 1);
  assert.equal(plan(input, { enabled: true, verifyCursor: () => ({ scopeKey: 'different', afterProviderId: 'provider_23' }) }).ok, false);
  assert.equal(plan(input, { enabled: true, verifyCursor: () => ({ scopeKey: result.plan.scopeKey, afterProviderId: '../private' }) }).ok, false);
  assert.equal(plan({ ...input, cursor: 'x'.repeat(513) }, deps).ok, false);
  assert.equal(checked, 1);
});

test('rejects accessor traps and exceptions without running getter or leaking errors', () => {
  let executed = 0;
  const bad = { cityKey: 'surat' };
  Object.defineProperty(bad, 'limit', { enumerable: true, get() { executed++; return 12; } });
  assert.deepEqual(plan(bad), { ok: false, code: 'PUBLIC_PROVIDER_QUERY_UNAVAILABLE' });
  assert.equal(executed, 0);
  const result = plan({ cityKey: 'surat', cursor: 't' }, {
    enabled: true, verifyCursor() { throw Error('secret-credential'); }
  });
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(result.ok, false);
  assert.equal(plan({ cityKey: 'surat' }, { get enabled() { executed++; return true; } }).ok, false);
  assert.equal(executed, 0);
  assert.equal(plan({ cityKey: 'surat' }, { enabled: true, unexpected: 1 }).ok, false);
});
