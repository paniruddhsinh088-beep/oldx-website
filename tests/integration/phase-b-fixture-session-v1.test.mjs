import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {authUids, firestoreDocs} from '../../scripts/phase-b-http-contract-review.mjs';
import {offlinePayloads, privateProduct} from '../../scripts/phase-b-firestore-typed-fixture-preview.mjs';
import {simulateFixtureSession, simulateFixtureAcceptance} from '../../scripts/phase-b-fixture-session-v1.mjs';

const googleToken = ('fake.' + Buffer.from(JSON.stringify({aud: 'https://oldx-owner-read-lqpaz3pd5a-el.a.run.app', iss: 'https://accounts.google.com', exp: 4102444800, email: 'oldx-phase-b-invoker@oldx-staging.iam.gserviceaccount.com', email_verified: true})).toString('base64url') + '.token');
const prefix = 'projects/oldx-staging/databases/(default)/documents/';
const time = '2026-11-14T00:00:00.000001Z';
const createdAt = '1794614400000';
const absent = {status: 404, data: {error: {status: 'NOT_FOUND'}}};
const ok = (data = {}) => ({status: 200, data});
const script = fileURLToPath(new URL('../../scripts/phase-b-fixture-session-v1.mjs', import.meta.url));

function fake(intercept = () => undefined) {
  const users = new Map();
  const docs = new Map();
  const records = [];
  const requests = [];
  const passwords = new Set();
  const latest = (resource) => records.findLast((entry) => entry.resource === resource);
  let sessionId;
  let opened = false;
  let closed = false;
  let complete = false;

  async function send(req) {
    if (req.url.endsWith('/documents:commit')) {
      const [write] = req.body.writes;
      assert.equal(req.body.writes.length, 1);
      assert.ok(write.delete.startsWith(prefix));
      const result = await send({method: 'DELETE', url: new URL(req.url).origin + '/v1/' +
        write.delete + '?currentDocument.updateTime=' + encodeURIComponent(write.currentDocument.updateTime)});
      return result.status === 204 ? ok({writeResults: [{}]}) : result;
    }
    const {method, body, publicRequest} = req;
    const url = new URL(req.url);
    requests.push(method + ' ' + url.pathname);
    const override = intercept(req, {users, docs, latest});
    if (override !== undefined) return override;
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      assert.equal(publicRequest, url.pathname.endsWith(':signInWithPassword'));
      if (!publicRequest) assert.match(url.pathname, /^\/v1\/projects\/oldx-staging\/accounts/);
      if (url.pathname.endsWith(':lookup')) {
        return ok({users: [...users.values()].filter((user) => body.localId?.includes(user.localId) || body.email?.includes(user.email))});
      }
      if (url.pathname.endsWith(':delete')) {
        assert.equal(latest(body.localId).state, 'DELETE_UNKNOWN');
        assert.equal(docs.size, 0);
        users.delete(body.localId);
        return ok();
      }
      if (url.pathname.endsWith(':signInWithPassword')) {
        const user = [...users.values()].find(({email}) => email === body.email);
        assert.ok(user && body.returnSecureToken && passwords.has(body.password));
        const claims = {sub: user.localId, aud: 'oldx-staging', iss: 'https://securetoken.google.com/oldx-staging',
          firebase: {sign_in_provider: 'password'}, exp: Math.floor(Date.now() / 1000) + 60};
        return ok({localId: user.localId, idToken: 'fake.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature',
          refreshToken: 'discarded-refresh'});
      }
      assert.equal(method, 'POST');
      assert.ok(authUids.includes(body.localId) && !users.has(body.localId));
      assert.equal(latest(body.localId).state, 'CREATE_UNKNOWN');
      assert.match(body.email, /@example\.invalid$/);
      assert.equal(body.disabled, false);
      assert.ok(body.password.length >= 43 && !passwords.has(body.password));
      passwords.add(body.password);
      users.set(body.localId, {localId: body.localId, email: body.email, createdAt});
      return ok({localId: body.localId});
    }
    assert.equal(url.hostname, 'firestore.googleapis.com');
    assert.ok(url.pathname.startsWith('/v1/' + prefix));
    const path = url.pathname.slice(('/v1/' + prefix).length);
    if (method === 'POST') {
      const id = path + '/' + url.searchParams.get('documentId');
      assert.ok(firestoreDocs.includes(id) && !docs.has(id));
      assert.equal(latest(id).state, 'CREATE_UNKNOWN');
      assert.deepEqual(body.fields, {...offlinePayloads()[id].fields, phaseBFixtureSessionId: {stringValue: sessionId}});
      const doc = {name: prefix + id, fields: structuredClone(body.fields), createTime: time, updateTime: time};
      docs.set(id, doc);
      return ok(doc);
    }
    assert.ok(firestoreDocs.includes(path));
    if (method === 'GET') return docs.has(path) ? ok(docs.get(path)) : absent;
    assert.equal(method, 'DELETE');
    assert.equal(latest(path).state, 'DELETE_UNKNOWN');
    assert.equal(url.searchParams.get('currentDocument.updateTime'), docs.get(path).updateTime);
    docs.delete(path);
    return {status: 204};
  }

  function openJournal(id) {
    sessionId = id;
    opened = true;
    return {
      record: (resource, state, evidence) => records.push({resource, state, evidence}),
      close: () => { closed = true; },
      complete: () => {
        assert.equal(docs.size + users.size, 0);
        assert.equal(requests.slice(-4).filter((request) => /lookup|^GET/.test(request)).length, 4);
        complete = true;
      },
    };
  }

  return {run: () => simulateFixtureSession(send, openJournal),
    accept: (acceptance) => simulateFixtureAcceptance({fixtureSend: send, openFakeJournal: openJournal, acceptance}),
    latest, requests, records,
    get opened() { return opened; }, get closed() { return closed; }, get complete() { return complete; }};
}

test('review works offline and execution remains hard-disabled', () => {
  const review = spawnSync(process.execPath, [script, '--review'], {encoding: 'utf8'});
  assert.equal(review.status, 0);
  assert.match(review.stdout, /Live execution disabled/);
  const execute = spawnSync(process.execPath, [script, '--execute'], {encoding: 'utf8'});
  assert.equal(execute.status, 2);
  assert.match(execute.stderr, /^STOP:/);
});

test('four create-only fixtures, two isolated sign-ins, conditional cleanup and final absence', async () => {
  const session = fake();
  await session.run();
  assert.ok(session.complete && session.closed);
  assert.equal(session.records.length, 16);
  assert.doesNotMatch(JSON.stringify(session.records), /password|idToken|refresh|signature/);
});

test('UID, email or document collision blocks journal and writes', async () => {
  for (const collision of ['uid', 'email', 'doc']) {
    const session = fake(({url, body, method}) => {
      if (collision === 'uid' && body?.localId?.[0] === authUids[0]) return ok({users: [{localId: authUids[0]}]});
      if (collision === 'email' && body?.email?.[0]) return ok({users: [{localId: authUids[1]}]});
      if (collision === 'doc' && method === 'GET' && url.endsWith(firestoreDocs[1])) return ok();
    });
    await assert.rejects(session.run(), /SIMULATION_STOPPED/);
    assert.equal(session.opened, false);
  }
});

test('ambiguous create records unknown before stopping, without retrying or exposing errors', async () => {
  const session = fake(({body}, {latest}) => {
    if (body?.password) {
      assert.equal(latest(authUids[0]).state, 'CREATE_UNKNOWN');
      throw new Error('private upstream details');
    }
  });
  await assert.rejects(session.run(), {message: 'SIMULATION_STOPPED'});
  assert.equal(session.records.length, 1);
  assert.ok(session.closed && !session.complete);
});

test('permission denial after first Auth create preserves partial provenance and stops writes', async () => {
  const session = fake(({body}) => {
    if (body?.localId === authUids[1] && body.password) return {status: 403};
  });
  await assert.rejects(session.run(), /SIMULATION_STOPPED/);
  assert.equal(session.latest(authUids[0]).state, 'CREATED_VERIFIED');
  assert.equal(session.latest(authUids[1]).state, 'CREATE_UNKNOWN');
  assert.equal(session.records.length, 3);
  assert.ok(session.closed && !session.complete);
});

test('wrong sign-in UID or token audience stops before deletion', async () => {
  for (const localId of authUids) {
    const session = fake(({url}) => {
      if (url.endsWith('signInWithPassword?key=offline-test-key')) {
        return ok({localId, idToken: 'fake.' + Buffer.from('{"aud":"other-project"}').toString('base64url') + '.signature'});
      }
    });
    await assert.rejects(session.run(), /SIMULATION_STOPPED/);
    assert.equal(session.records.length, 8);
  }
});

test('modified document or replaced Auth account blocks its deletion', async () => {
  for (const kind of ['doc', 'marker', 'missing-marker', 'create-time', 'owner', 'auth']) {
    const target = kind === 'auth' ? authUids[0] : firestoreDocs[1];
    const session = fake(({method, url, body}, {docs, users, latest}) => {
      if (latest(target)?.state !== 'CREATED_VERIFIED') return;
      if (kind !== 'auth' && method === 'GET' && url.endsWith(target)) {
        const changed = structuredClone(docs.get(target));
        if (kind === 'doc') changed.updateTime = '2026-11-14T00:00:01Z';
        if (kind === 'create-time') changed.createTime = '2026-11-14T00:00:01Z';
        if (kind === 'marker') changed.fields.phaseBFixtureSessionId.stringValue = 'different-session';
        if (kind === 'missing-marker') delete changed.fields.phaseBFixtureSessionId;
        if (kind === 'owner') changed.fields.ownerUid.stringValue = 'unexpected-owner';
        return ok(changed);
      }
      if (kind === 'auth' && body?.localId?.[0] === target) {
        return ok({users: [{...users.get(target), createdAt: '1794614400001'}]});
      }
    });
    await assert.rejects(session.run(), /SIMULATION_STOPPED/);
    assert.equal(session.latest(target).state, 'CREATED_VERIFIED');
  }
});

test('conflicted or ambiguous deletion is journaled, never retried', async () => {
  for (const result of [{status: 412}, new Error('transport error')]) {
    const session = fake(({method}, {latest}) => {
      if (method !== 'DELETE') return;
      assert.equal(latest(firestoreDocs[1]).state, 'DELETE_UNKNOWN');
      if (result instanceof Error) throw result;
      return result;
    });
    await assert.rejects(session.run(), /SIMULATION_STOPPED/);
    assert.equal(session.requests.filter((req) => req.startsWith('DELETE')).length, 1);
    assert.equal(session.latest(firestoreDocs[1]).state, 'DELETE_UNKNOWN');
  }
});

test('successful delete response with residual resource cannot complete session', async () => {
  const session = fake(({url, body}) => {
    if (url.endsWith(':delete') && body.localId === authUids[1]) return ok();
  });
  await assert.rejects(session.run(), /SIMULATION_STOPPED/);
  assert.ok(session.closed && !session.complete);
});

test('integrated Phase B acceptance binds fixture identities before guarded cleanup', async () => {
  const root = '---oldx-owner-read-lqpaz3pd5a-el.a.run.app';
  const error = (code) => ({ok: false, error: {code}});
  const replies = {
    'disabled-health': [200, {ok: true}],
    'disabled-owner': [503, error('ENFORCEMENT_UNAVAILABLE')],
    'invoker-denied': [403, undefined],
    owner: [200, {ok: true, id: privateProduct.id, revision: 1, profile: privateProduct.profile,
      published: false, publicationRevision: 0, receipt: null}],
    'foreign-buyer': [403, error('DENIED')],
    'missing-firebase': [401, error('AUTH_REQUIRED')],
    'invalid-firebase': [401, error('AUTH_REQUIRED')],
  };
  for (const rejectOwner of [false, true]) {
    const session = fake();
    const seen = [];
    const pending = session.accept({
      disabledOrigin: 'https://healthcheck' + root,
      enabledOrigin: 'https://phase-b-acceptance' + root,
      enabledTag: 'phase-b-acceptance',
      googleToken: googleToken,
      send({caseId, headers}) {
        seen.push(caseId);
        assert.equal(session.records.length, 8);
        const token = headers.Authorization?.split('.')[1];
        if (['disabled-owner', 'owner', 'foreign-buyer'].includes(caseId)) {
          const {sub} = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
          assert.equal(sub, authUids[caseId === 'foreign-buyer' ? 1 : 0]);
        }
        assert.equal(headers['X-Serverless-Authorization'],
          caseId === 'invoker-denied' ? undefined : 'Bearer ' + googleToken);
        const [status, body] = replies[caseId];
        return {status: rejectOwner && caseId === 'owner' ? 503 : status, body, cacheControl: 'private, no-store'};
      },
    });
    if (rejectOwner) {
      await assert.rejects(pending, /SIMULATION_STOPPED/);
      assert.deepEqual(seen, Object.keys(replies).slice(0, 4));
      assert.ok(session.closed && !session.complete);
      assert.equal(session.records.length, 8);
    } else {
      assert.deepEqual((await pending).passed, Object.keys(replies));
      assert.ok(session.closed && session.complete);
      assert.equal(session.records.length, 16);
    }
  }
});
