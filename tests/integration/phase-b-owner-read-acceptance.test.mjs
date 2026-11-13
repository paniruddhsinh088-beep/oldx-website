import assert from 'node:assert/strict';
import test from 'node:test';
import {runOwnerReadAcceptance} from '../../scripts/phase-b-owner-read-acceptance.mjs';
import {privateProduct} from '../../scripts/phase-b-firestore-typed-fixture-preview.mjs';

const root = '---oldx-owner-read-38472235077.asia-south1.run.app';
const inputs = {
  disabledOrigin: 'https://healthcheck' + root,
  enabledOrigin: 'https://phase-b-acceptance' + root,
  enabledTag: 'phase-b-acceptance',
  googleToken: 'fake.eyJhdWQiOiJodHRwczovL29sZHgtb3duZXItcmVhZC0zODQ3MjIzNTA3Ny5hc2lhLXNvdXRoMS5ydW4uYXBwIiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwiZXhwIjo0MTAyNDQ0ODAwfQ.token',
  ownerToken: 'fake.owner.token',
  buyerToken: 'fake.buyer.token',
};
const error = (code) => ({ok: false, error: {code}});
const responses = {
  'disabled-health': [200, {ok: true}],
  'disabled-owner': [503, error('ENFORCEMENT_UNAVAILABLE')],
  'invoker-denied': [403, undefined],
  owner: [200, {ok: true, id: privateProduct.id, revision: 1, profile: privateProduct.profile,
    published: false, publicationRevision: 0, receipt: null}],
  'foreign-buyer': [403, error('DENIED')],
  'missing-firebase': [401, error('AUTH_REQUIRED')],
  'invalid-firebase': [401, error('AUTH_REQUIRED')],
  'wrong-project': [401, error('AUTH_REQUIRED')],
  'quota-limit': [429, error('RATE_LIMITED')],
  'quota-failure': [503, error('UNAVAILABLE')],
};
function reply(caseId) {
  const [status, body] = responses[caseId];
  return {status, body, cacheControl: 'private, no-store'};
}

test('bounded matrix separates caller and Firebase identities and checks the exact fixture DTO', async () => {
  const seen = [];
  const firebase = {owner: inputs.ownerToken, 'foreign-buyer': inputs.buyerToken,
    'disabled-owner': inputs.ownerToken, 'invalid-firebase': 'invalid.test.signature',
    'wrong-project': 'fake.other.project', 'quota-limit': inputs.ownerToken, 'quota-failure': inputs.ownerToken};
  const result = await runOwnerReadAcceptance({...inputs, wrongProjectToken: 'fake.other.project',
    quotaMode: 'controlled', send(request) {
      const {caseId, headers, body} = request;
      seen.push(caseId);
      assert.equal(headers['X-Serverless-Authorization'],
        caseId === 'invoker-denied' ? undefined : 'Bearer ' + inputs.googleToken);
      assert.equal(headers.Authorization, firebase[caseId] ? 'Bearer ' + firebase[caseId] : undefined);
      assert.equal(request.redirect, 'error');
      assert.ok(request.signal instanceof AbortSignal);
      if (body) assert.deepEqual(JSON.parse(body), {kind: 'product', id: privateProduct.id, requestId: null});
      return reply(caseId);
    }});
  assert.deepEqual(seen, Object.keys(responses));
  assert.deepEqual(result, {passed: seen, deferred: []});
});

test('unexpected data, caching or a transport failure stops immediately and stays redacted', async () => {
  for (const issue of ['extra-data', 'cache', 'transport']) {
    const seen = [];
    await assert.rejects(runOwnerReadAcceptance({...inputs, send({caseId}) {
      seen.push(caseId);
      const response = reply(caseId);
      if (caseId !== 'owner') return response;
      if (issue === 'transport') throw new Error('raw upstream detail');
      if (issue === 'cache') return {...response, cacheControl: 'public'};
      return {...response, body: {...response.body, legacyRecord: 'unexpected'}};
    }}), {message: 'ACCEPTANCE_STOPPED_owner'});
    assert.deepEqual(seen, ['disabled-health', 'disabled-owner', 'invoker-denied', 'owner']);
  }
});

test('wrong origin or shared identity cannot send requests and optional probes report deferred', async () => {
  await assert.rejects(runOwnerReadAcceptance({...inputs, googleToken: 'fake.other.audience',
    send() { assert.fail('Unexpected request'); }}), /INVOCATION_AUDIENCE_UNVERIFIED/);
  const send = ({caseId}) => reply(caseId);
  for (const patch of [{enabledOrigin: inputs.enabledOrigin + '/extra'}, {buyerToken: inputs.googleToken}]) {
    await assert.rejects(runOwnerReadAcceptance({...inputs, ...patch,
      send() { assert.fail('Unexpected request'); }}), /INVALID_ACCEPTANCE_INPUT|UNAPPROVED_ACCEPTANCE_TARGET/);
  }
  const result = await runOwnerReadAcceptance({...inputs, send});
  assert.deepEqual(result.deferred, ['wrong-project', 'quota-limit', 'quota-failure']);
});
