/** Phase B acceptance contract. Import-only, with no live transport or credential loader. */
import {isDeepStrictEqual} from 'node:util';
import {privateProduct} from './phase-b-firestore-typed-fixture-preview.mjs';
import {authUids, project} from './phase-b-http-contract-review.mjs';

const route = '/api/staging/marketplace/owner';
const fixtureRequest = JSON.stringify({kind: 'product', id: privateProduct.id, requestId: null});
const ownerResponse = {
  ok: true, id: privateProduct.id, revision: privateProduct.revision,
  profile: privateProduct.profile, published: false, publicationRevision: 0, receipt: null,
};

function checkedOrigin(origin, tag) {
  // Require the deterministic project-number URL. The operator must also
  // independently verify tag-to-revision and traffic mappings before any live run.
  const expected = 'https://' + tag + '---oldx-owner-read-38472235077.asia-south1.run.app';
  if (origin !== expected || !/^[a-z][a-z0-9-]{0,30}$/.test(tag)) throw new Error('UNAPPROVED_ACCEPTANCE_TARGET');
  return origin;
}

// The token is supplied in memory by a separately authorized keyless caller.
// Cloud Run, not this local claims check, authenticates the signature and IAM.
function checkGoogleInvocationAudience(token) {
  try {
    const parts = token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part)) &&
        claims.aud === 'https://oldx-owner-read-38472235077.asia-south1.run.app' &&
        ['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) &&
        Number.isSafeInteger(claims.exp) && claims.exp > Date.now() / 1000) {
      if (claims.email === 'oldx-phase-b-invoker@oldx-staging.iam.gserviceaccount.com' &&
          claims.email_verified === true) return;
      throw new Error('INVOCATION_IDENTITY_UNVERIFIED');
    }
  } catch (error) {
    if (error.message === 'INVOCATION_IDENTITY_UNVERIFIED') throw error;
    // Never include token data in errors.
  }
  throw new Error('INVOCATION_AUDIENCE_UNVERIFIED');
}

function checkFirebaseIdentity(token, uid) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (claims.sub === uid && claims.aud === project &&
        claims.iss === 'https://securetoken.google.com/' + project &&
        claims.firebase?.sign_in_provider === 'password' &&
        Number.isSafeInteger(claims.exp) && claims.exp > Date.now() / 1000) return;
  } catch {
    // Do not expose claims or parsing errors.
  }
  throw new Error('FIXTURE_IDENTITY_UNVERIFIED');
}

export async function runOwnerReadAcceptance({
  send, disabledOrigin, enabledOrigin, enabledTag, googleToken, ownerToken, buyerToken,
  wrongProjectToken, quotaMode = 'deferred',
}) {
  const disabled = checkedOrigin(disabledOrigin, 'healthcheck');
  const enabled = checkedOrigin(enabledOrigin, enabledTag);
  if (enabled === disabled || typeof send !== 'function' ||
      ![googleToken, ownerToken, buyerToken].every((token) =>
        typeof token === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) ||
      new Set([googleToken, ownerToken, buyerToken]).size !== 3 ||
      !['deferred', 'controlled'].includes(quotaMode) ||
      (wrongProjectToken !== undefined &&
        (typeof wrongProjectToken !== 'string' ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(wrongProjectToken) ||
          [googleToken, ownerToken, buyerToken].includes(wrongProjectToken)))) {
    throw new Error('INVALID_ACCEPTANCE_INPUT');
  }
  checkGoogleInvocationAudience(googleToken);
  checkFirebaseIdentity(ownerToken, authUids[0]);
  checkFirebaseIdentity(buyerToken, authUids[1]);

  const passed = [];
  const deadline = performance.now() + 60 * 60 * 1000;
  const failure = (code) => ({ok: false, error: {code}});
  async function probe(name, origin, status, expected, {firebase, invoke = true, health = false} = {}) {
    const headers = {};
    if (!health) headers['Content-Type'] = 'application/json';
    if (invoke) headers['X-Serverless-Authorization'] = 'Bearer ' + googleToken;
    if (firebase) headers.Authorization = 'Bearer ' + firebase;
    try {
      const remaining = deadline - performance.now();
      if (remaining < 1 || passed.length >= 200) throw new Error();
      const signal = AbortSignal.timeout(Math.floor(Math.min(remaining, 15_000)));
      const response = await send({
        caseId: name, url: origin + (health ? '/health' : route),
        method: health ? 'GET' : 'POST', headers, body: health ? undefined : fixtureRequest,
        redirect: 'error', signal,
      });
      if (signal.aborted || response.status !== status ||
          (expected !== undefined && (response.cacheControl !== 'private, no-store' ||
            !isDeepStrictEqual(response.body, expected))) ||
          (expected === undefined && response.body !== undefined)) throw new Error();
      passed.push(name);
    } catch {
      // Suppress response bodies, headers and transport errors.
      throw new Error('ACCEPTANCE_STOPPED_' + name);
    }
  }
  await probe('disabled-health', disabled, 200, {ok: true}, {health: true});
  await probe('disabled-owner', disabled, 503, failure('ENFORCEMENT_UNAVAILABLE'), {firebase: ownerToken});
  await probe('invoker-denied', enabled, 403, undefined, {invoke: false, health: true});
  await probe('owner', enabled, 200, ownerResponse, {firebase: ownerToken});
  await probe('foreign-buyer', enabled, 403, failure('DENIED'), {firebase: buyerToken});
  await probe('missing-firebase', enabled, 401, failure('AUTH_REQUIRED'));
  await probe('invalid-firebase', enabled, 401, failure('AUTH_REQUIRED'), {firebase: 'invalid.test.signature'});
  if (wrongProjectToken !== undefined) {
    await probe('wrong-project', enabled, 401, failure('AUTH_REQUIRED'), {firebase: wrongProjectToken});
  }
  if (quotaMode === 'controlled') {
    // Offline or an explicitly reviewed setup that controls quota state and
    // dependency failure independently. The harness does not induce cloud faults.
    await probe('quota-limit', enabled, 429, failure('RATE_LIMITED'), {firebase: ownerToken});
    await probe('quota-failure', enabled, 503, failure('UNAVAILABLE'), {firebase: ownerToken});
  }
  return {passed, deferred: [
    ...(wrongProjectToken === undefined ? ['wrong-project'] : []),
    ...(quotaMode === 'deferred' ? ['quota-limit', 'quota-failure'] : []),
  ]};
}
