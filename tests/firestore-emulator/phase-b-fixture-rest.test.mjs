import assert from 'node:assert/strict';
import test from 'node:test';
import {boundedPhaseBRequest, simulateFixtureSession, inspectRecovery} from '../../scripts/phase-b-fixture-session-v1.mjs';
import {authUids, firestoreDocs} from '../../scripts/phase-b-http-contract-review.mjs';

const project = 'demo-oldx-phase-b';
const auth = '127.0.0.1:9098';
const firestore = '127.0.0.1:8088';
const demoDocumentRoot = 'projects/' + project + '/databases/(default)/documents/';
const stagingDocumentRoot = 'projects/oldx-staging/databases/(default)/documents/';

test('isolated Phase B REST lifecycle verifies fixed UID, collisions, conditional delete and recovery', async (t) => {
  assert.equal(process.env.GCLOUD_PROJECT, project);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, auth);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, firestore);
  const records = new Map();
  let completed = false;
  let checkedCreate = false;
  let checkedDelete = false;
  const statuses = [];
  t.after(() => t.diagnostic(JSON.stringify({statuses, journalStates: [...records.values()]})));
  async function send({url, method, body, publicRequest}) {
    const source = new URL(url);
    const isAuth = source.hostname === 'identitytoolkit.googleapis.com';
    assert.ok(isAuth || source.hostname === 'firestore.googleapis.com');
    const path = source.pathname.replace('/projects/oldx-staging/', '/projects/' + project + '/');
    const target = isAuth ? 'http://' + auth + '/' + source.hostname + path : 'http://' + firestore + path;
    const headers = {'Content-Type': 'application/json', ...(!publicRequest && {Authorization: 'Bearer owner'})};
    const isCommit = path.endsWith('/documents:commit');
    const payload = isCommit ? {writes: body.writes.map((write) => ({
      ...write, delete: write.delete.replace(stagingDocumentRoot, demoDocumentRoot),
    }))} : body;
    const request = (endpoint, customHeaders = headers, data = payload) => boundedPhaseBRequest(endpoint, {
      method, headers: customHeaders, body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });
    const result = await request(target + source.search);
    statuses.push([isAuth ? path.split('/').at(-1) : 'firestore', method, result.status]);
    if (isAuth && path.endsWith('/accounts') && result.status === 200 && !checkedCreate) {
      checkedCreate = true;
      assert.equal(result.data.localId, authUids[0]);
      const denied = await request(target + source.search, {'Content-Type': 'application/json'});
      assert.ok([400, 401, 403].includes(denied.status));
      assert.ok(denied.data?.error || denied.data === undefined);
      assert.equal((await request(target + source.search)).status, 400);
    }
    if (!isAuth && !isCommit && method === 'POST' && result.status === 200) {
      assert.equal((await request(target + source.search)).status, 409);
    }
    if (isCommit && !checkedDelete) {
      // The fixture runner's original timestamp was applied above. Check a
      // stale conditional delete independently against the remaining document.
      checkedDelete = true;
      const stale = await request(target, headers, {writes: [{
        delete: demoDocumentRoot + firestoreDocs[0],
        currentDocument: {updateTime: '2000-01-01T00:00:00Z'},
      }]});
      assert.ok([400, 409, 412].includes(stale.status));
    }
    if (!isAuth && result.data?.name?.startsWith(demoDocumentRoot)) {
      result.data.name = result.data.name.replace(demoDocumentRoot, stagingDocumentRoot);
    }
    return result;
  }

  await simulateFixtureSession(send, () => ({
    record(resource, state) { records.set(resource, state); },
    complete() { completed = true; },
    close() {},
  }), (owner, buyer) => {
    assert.notEqual(owner, buyer);
    assert.equal(records.size, 4);
    assert.ok([...records.values()].every((state) => state === 'CREATED_VERIFIED'));
  }, {emulator: true});
  assert.ok(completed && checkedCreate && checkedDelete);
  assert.equal((await inspectRecovery(send)).allAbsent, true);
});
