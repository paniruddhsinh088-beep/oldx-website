import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectRecovery, parseRecoveryJournal} from '../../scripts/phase-b-fixture-session-v1.mjs';
import {authUids, firestoreDocs} from '../../scripts/phase-b-http-contract-review.mjs';
import {offlinePayloads} from '../../scripts/phase-b-firestore-typed-fixture-preview.mjs';

const at = '2026-11-14T00:00:00.000Z';
const now = Date.parse(at);
const sessionId = 'b21d808a-003e-41e1-80ae-7d3efbb3dc70';
const [uid, buyer] = authUids;
const [actor, product] = firestoreDocs;
const email = uid + '-' + sessionId + '@example.invalid';
const createdAt = String(now);
const header = {version: 2, project: 'oldx-staging', database: '(default)', sessionId};
const encode = (...entries) => entries.map((entry) => JSON.stringify({at, ...entry})).join('\n') + '\n';
const absent = {status: 404, data: {error: {status: 'NOT_FOUND'}}};
const ok = (data) => ({status: 200, data});
const intent = {resource: uid, state: 'CREATE_UNKNOWN', evidence: {email}};
const verified = {resource: uid, state: 'CREATED_VERIFIED', evidence: {email, createdAt}};

test('journal detects partial lines, stale or future timestamps and inconsistent session identity', () => {
  const valid = encode(header, intent, verified);
  assert.equal(parseRecoveryJournal(valid, now).stale, false);
  assert.equal(parseRecoveryJournal(valid, now + 86_400_000).stale, true);
  assert.throws(() => parseRecoveryJournal(valid + '{', now), /INCOMPLETE_JOURNAL/);
  assert.throws(() => parseRecoveryJournal(valid, now - 1), /INVALID_JOURNAL_TIME/);
  assert.throws(() => parseRecoveryJournal(encode(header, verified), now), /INVALID_JOURNAL_TRANSITION/);
  assert.throws(() => parseRecoveryJournal(encode(header, {...intent, evidence: {email: uid + '-other@example.invalid'}}), now),
    /INVALID_CREATE_EVIDENCE/);
});

test('recovery inspects all four IDs independently and reports ambiguous outcomes without exposing evidence', async () => {
  const journal = parseRecoveryJournal(encode(header, intent, verified,
    {resource: uid, state: 'DELETE_UNKNOWN', evidence: verified.evidence},
    {resource: actor, state: 'CREATE_UNKNOWN', evidence: {marker: sessionId}}), now);
  const seen = [];
  const result = await inspectRecovery(({method, url, body}) => {
    const id = body?.localId?.[0] ?? url.split('/documents/')[1];
    seen.push(id);
    if (body) {
      assert.equal(method, 'POST');
      assert.match(url, /\/oldx-staging\/accounts:lookup$/);
      if (id === uid) return ok({users: [{localId: uid, email, createdAt}]});
      throw new Error('private lookup failure');
    }
    assert.equal(method, 'GET');
    return id === actor ? ok({}) : absent;
  }, journal);
  assert.deepEqual(seen, [uid, buyer, actor, product]);
  assert.deepEqual(result.observations.map(({observation}) => observation), [
    'PRESENT_MATCHES_JOURNAL_REQUIRES_OWNER_REVIEW', 'LOOKUP_UNVERIFIED',
    'PRESENT_WITHOUT_VERIFIED_CREATION', 'ABSENT_AT_CHECK_TIME',
  ]);
  assert.equal(result.allAbsent, false);
  assert.ok(!JSON.stringify(result).includes(email));
});

test('changed Firestore revision and reappearing Auth UID remain unresolved', async () => {
  const journal = parseRecoveryJournal(encode(header, intent, verified,
    {resource: uid, state: 'DELETE_UNKNOWN', evidence: verified.evidence},
    {resource: uid, state: 'DELETE_ACKNOWLEDGED'},
    {resource: product, state: 'CREATE_UNKNOWN', evidence: {marker: sessionId}},
    {resource: product, state: 'CREATED_VERIFIED', evidence: {marker: sessionId, createTime: at, updateTime: at}}), now);
  const result = await inspectRecovery(({url, body}) => {
    if (body) return ok({users: body.localId[0] === uid ? [{localId: uid, email, createdAt}] : []});
    if (!url.endsWith(product)) return absent;
    return ok({name: 'projects/oldx-staging/databases/(default)/documents/' + product,
      createTime: at, updateTime: '2026-11-14T00:00:01Z', fields: {...offlinePayloads()[product].fields, phaseBFixtureSessionId: {stringValue: sessionId}}});
  }, journal);
  assert.equal(result.observations[0].observation, 'PRESENT_AFTER_DELETE_ACK');
  assert.equal(result.observations[3].observation, 'PRESENT_PROVENANCE_MISMATCH');
  assert.equal(result.allAbsent, false);
});

test('missing journal never supplies provenance and all four successful absence reads are required', async () => {
  const missing = await inspectRecovery(({body}) => body ? ok({}) : absent);
  assert.equal(missing.observations.length, 4);
  assert.equal(missing.allAbsent, true);
  const denied = await inspectRecovery(({body}) => body ? ok({}) : {status: 403});
  assert.equal(denied.allAbsent, false);
});

test('legacy Firestore receipts preserve Auth recovery but cannot prove document provenance', async () => {
  const entries = [{...header, version: 1}, intent, verified,
    {resource: product, state: 'CREATE_UNKNOWN'},
    {resource: product, state: 'CREATED_VERIFIED', evidence: {updateTime: at}}];
  const journal = parseRecoveryJournal(encode(...entries), now);
  assert.deepEqual(journal.evidence.get(product), {updateTime: at});
  const result = await inspectRecovery(({method, url, body}) => {
    if (method === 'POST') {
      assert.ok(url.endsWith('/accounts:lookup'));
      return body.localId[0] === uid ? ok({users: [{localId: uid, email, createdAt}]}) : ok({});
    }
    assert.equal(method, 'GET');
    if (!url.endsWith(product)) return absent;
    return ok({name: 'projects/oldx-staging/databases/(default)/documents/' + product,
      createTime: at, updateTime: at, fields: {...offlinePayloads()[product].fields,
        phaseBFixtureSessionId: {stringValue: sessionId}}});
  }, journal);
  assert.equal(result.observations[0].observation, 'PRESENT_MATCHES_JOURNAL_REQUIRES_OWNER_REVIEW');
  assert.equal(result.observations[3].observation, 'PRESENT_PROVENANCE_MISMATCH');
  assert.throws(() => parseRecoveryJournal(encode(...entries.slice(0, -1),
    {...entries.at(-1), evidence: {updateTime: 'invalid'}}), now), /INVALID_CREATION_EVIDENCE/);
});
