import assert from 'node:assert/strict';
import test from 'node:test';
import {runOwnerReadAcceptance, runHostedOwnerReadAcceptance, simulateKeylessOwnerReadAcceptance} from '../../scripts/phase-b-owner-read-acceptance.mjs';
import {privateProduct} from '../../scripts/phase-b-firestore-typed-fixture-preview.mjs';

const googleToken = ('fake.' + Buffer.from(JSON.stringify({aud: 'https://oldx-owner-read-38472235077.asia-south1.run.app', iss: 'https://accounts.google.com', exp: 4102444800, email: 'oldx-phase-b-invoker@oldx-staging.iam.gserviceaccount.com', email_verified: true})).toString('base64url') + '.token');
const root = '---oldx-owner-read-38472235077.asia-south1.run.app';
const firebaseToken = (sub) => 'fake.' + Buffer.from(JSON.stringify({sub, aud: 'oldx-staging', iss: 'https://securetoken.google.com/oldx-staging', exp: 4102444800, firebase: {sign_in_provider: 'password'}})).toString('base64url') + '.token';
const inputs = {
  disabledOrigin: 'https://healthcheck' + root,
  enabledOrigin: 'https://phase-b-acceptance' + root,
  enabledTag: 'phase-b-acceptance',
  googleToken: googleToken,
  ownerToken: firebaseToken('synthetic-seller-a'),
  buyerToken: firebaseToken('synthetic-buyer-b'),
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
  const wrongCaller = 'fake.' + Buffer.from(JSON.stringify({
    aud: 'https://oldx-owner-read-38472235077.asia-south1.run.app', iss: 'https://accounts.google.com',
    exp: 4102444800, email: 'other@example.invalid', email_verified: true,
  })).toString('base64url') + '.token';
  for (const [patch, expected] of [
    [{googleToken: wrongCaller}, /INVOCATION_IDENTITY_UNVERIFIED/],
    [{ownerToken: firebaseToken('unrelated-owner')}, /FIXTURE_IDENTITY_UNVERIFIED/],
  ]) {
    await assert.rejects(runOwnerReadAcceptance({...inputs, ...patch,
      send() { assert.fail('Unexpected request'); }}), expected);
  }
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

const hosted = {...inputs, projectId: 'oldx-staging', getOperatorAccessToken: async () => 'synthetic-access-token'};

test('keyless transport mints once and keeps operator OAuth separate from hosted headers', async () => {
  const cases = Object.keys(responses).slice(0, 7);
  let requests = 0;
  const result = await simulateKeylessOwnerReadAcceptance(hosted, async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    if (requests++ === 0) {
      assert.equal(url, 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/oldx-phase-b-invoker@oldx-staging.iam.gserviceaccount.com:generateIdToken');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-access-token');
      assert.equal(options.headers['X-Goog-User-Project'], 'oldx-staging');
      assert.deepEqual(JSON.parse(options.body), {
        audience: 'https://oldx-owner-read-38472235077.asia-south1.run.app', includeEmail: true,
      });
      return Response.json({token: googleToken});
    }
    const name = cases[requests - 2];
    const origin = name.startsWith('disabled') ? inputs.disabledOrigin : inputs.enabledOrigin;
    const health = ['disabled-health', 'invoker-denied'].includes(name);
    assert.equal(url, origin + (health ? '/health' : '/api/staging/marketplace/owner'));
    assert.equal(options.method, health ? 'GET' : 'POST');
    assert.equal(options.headers['X-Serverless-Authorization'], name === 'invoker-denied' ? undefined : 'Bearer ' + googleToken);
    const firebase = {'disabled-owner': inputs.ownerToken, owner: inputs.ownerToken,
      'foreign-buyer': inputs.buyerToken, 'invalid-firebase': 'invalid.test.signature'}[name];
    assert.equal(options.headers.Authorization, firebase ? 'Bearer ' + firebase : undefined);
    const [status, body] = responses[name];
    return body === undefined ? new Response(null, {status}) :
      Response.json(body, {status, headers: {'cache-control': 'private, no-store'}});
  });
  assert.equal(requests, 8);
  assert.deepEqual(result.passed, cases);
});

test('hosted gate and invalid project or fixture identity stop before credentials', async () => {
  const options = {...hosted, getOperatorAccessToken() { assert.fail('Credential callback reached'); }};
  const noFetch = () => assert.fail('Fetch reached');
  await assert.rejects(runHostedOwnerReadAcceptance(options), {message: 'HOSTED_ACCEPTANCE_DISABLED'});
  await assert.rejects(simulateKeylessOwnerReadAcceptance({...options, projectId: 'another-project'}, noFetch),
    {message: 'INVALID_HOSTED_ACCEPTANCE_INPUT'});
  await assert.rejects(simulateKeylessOwnerReadAcceptance({...options, buyerToken: inputs.ownerToken}, noFetch),
    {message: 'FIXTURE_IDENTITY_UNVERIFIED'});
});

test('mint denial, timeout, wrong claims and malformed responses stop without retry', async () => {
  const cases = [
    [() => new Response('private detail', {status: 403}), 'INVOCATION_TOKEN_GENERATION_FAILED'],
    [() => { throw new DOMException('private timeout detail', 'TimeoutError'); }, 'INVOCATION_TOKEN_GENERATION_FAILED'],
    [() => new Response('{'), 'INVOCATION_TOKEN_GENERATION_FAILED'],
    [() => Response.json({token: 'fake.invalid.token'}), 'INVOCATION_AUDIENCE_UNVERIFIED'],
    [() => {
      const claims = JSON.parse(Buffer.from(googleToken.split('.')[1], 'base64url'));
      claims.email = 'wrong@example.invalid';
      return Response.json({token: 'fake.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.token'});
    }, 'INVOCATION_IDENTITY_UNVERIFIED'],
  ];
  for (const [respond, message] of cases) {
    let count = 0;
    await assert.rejects(simulateKeylessOwnerReadAcceptance(hosted, () => {
      count++;
      return respond();
    }), {message});
    assert.equal(count, 1);
  }
});

test('hosted transport fails closed on oversized or unexpected denial body', async () => {
  let count = 0;
  await assert.rejects(simulateKeylessOwnerReadAcceptance(hosted, () => {
    switch (++count) {
      case 1: return Response.json({token: googleToken});
      case 2: return Response.json({ok: true}, {headers: {'cache-control': 'private, no-store'}});
      case 3: return Response.json(error('ENFORCEMENT_UNAVAILABLE'),
        {status: 503, headers: {'cache-control': 'private, no-store'}});
      default: return Response.json({unexpected: true}, {status: 403});
    }
  }), {message: 'ACCEPTANCE_STOPPED_invoker-denied'});
  assert.equal(count, 4);
  await assert.rejects(simulateKeylessOwnerReadAcceptance(hosted, () => new Response('x'.repeat(32_769))),
    {message: 'INVOCATION_TOKEN_GENERATION_FAILED'});
});
