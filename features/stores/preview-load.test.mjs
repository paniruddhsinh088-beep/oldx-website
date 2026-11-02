import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreLoadController, projectPreviewSnapshot } from './preview-load.mjs';
import { readSyntheticStore } from './preview-adapter.mjs';
import { sampleStores, sampleListings } from './preview-fixtures.mjs';
const scope = { storeUid: 'demo-shop', category: 'all', sort: 'newest', page: 1 };
const response = () => ({ status: 'published', store: { ...sampleStores[0], phone: 'PRIVATE' },
  records: sampleListings.map(row => ({ ...row, publicationStatus: 'published', userIp: 'PRIVATE', phone: 'PRIVATE', verified: true })) });
function harness() {
  const pending = [], states = [];
  const controller = createStoreLoadController({ onChange: state => states.push(state), read(request, { signal }) {
    return new Promise((resolve, reject) => pending.push({ request, signal, resolve, reject }));
  } });
  return { controller, pending, states, last: () => states.at(-1) };
}

test('new scopes clear snapshots immediately and ignore out-of-order completion even if abort is ignored', async () => {
  const { controller, pending, last } = harness();
  const old = controller.load(scope);
  const fresh = controller.load({ ...scope, category: 'books', sort: 'price-low', page: 2 });
  assert.equal(pending[0].signal.aborted, true);
  assert.deepEqual(last(), { status: 'loading' });
  pending[1].resolve(response()); await fresh;
  const accepted = last(); assert.equal(accepted.status, 'ready');
  pending[0].resolve({ status: 'revoked' }); await old;
  assert.equal(last(), accepted);
});

test('revocation clears accepted data and invalidates pending pagination and late failures', async () => {
  const { controller, pending, last } = harness();
  const first = controller.load(scope); pending[0].resolve(response()); await first;
  assert.equal(last().status, 'ready');
  const next = controller.load({ ...scope, page: 2 });
  controller.revoke(); assert.deepEqual(last(), { status: 'revoked' });
  pending[1].resolve(response()); await next;
  assert.deepEqual(last(), { status: 'revoked' });
  const another = controller.load(scope); controller.clear(); pending[2].reject(new Error('PRIVATE'));
  await another; assert.deepEqual(last(), { status: 'idle' });
});

test('invalid and failed reads expose no stale snapshot or raw error details and can recover', async () => {
  const { controller, pending, last } = harness();
  for (const result of [null, { status: 'published', store: sampleStores[0], records: Array(2) },
    { ...response(), store: { ...sampleStores[0], id: 'other' } }]) {
    const task = controller.load(scope); pending.at(-1).resolve(result); await task;
    assert.deepEqual(last(), { status: 'error', code: 'INVALID_PREVIEW_RESPONSE' });
  }
  const fail = controller.load(scope); pending.at(-1).reject(new Error('PRIVATE')); await fail;
  assert.deepEqual(last(), { status: 'error', code: 'PREVIEW_READ_FAILED' });
  const recover = controller.load(scope); pending.at(-1).resolve(response()); await recover;
  assert.equal(last().status, 'ready');
  assert.equal(JSON.stringify(last()).includes('PRIVATE'), false);
});

test('snapshot projection strips private fields, clones deeply and rejects malformed public data', () => {
  const raw = response(); const projected = projectPreviewSnapshot(raw, scope.storeUid);
  assert.equal(projected.status, 'ready'); assert.equal(JSON.stringify(projected).includes('PRIVATE'), false);
  assert.equal(Object.hasOwn(projected.records[0], 'verified'), false);
  raw.store.name = 'Changed'; raw.records[0].createdAt = { seconds: 0, nanoseconds: 0 };
  assert.notEqual(projected.store.name, 'Changed'); assert.notEqual(projected.records[0].createdAt.seconds, 0);
  for (const patch of [{ publicationStatus: 'suspended' }, { publicationStatus: 'pending_review' }, { publicationStatus: undefined }, { title: '<script>' }, { sellerUid: 'other' }, { createdAt: { seconds: 1, nanoseconds: 1e9 } }]) {
    assert.equal(projectPreviewSnapshot({ ...response(), records: [{ ...sampleListings[0], publicationStatus: 'published', ...patch }] }, scope.storeUid), null);
  }
  assert.deepEqual(projectPreviewSnapshot({ status: 'revoked', records: ['PRIVATE'] }, scope.storeUid), { status: 'revoked' });
});

test('mock adapter has bounded synthetic delay, abort cleanup, failure and revocation scenarios', async () => {
  assert.equal((await readSyntheticStore(scope)).store.id, scope.storeUid);
  assert.equal((await readSyntheticStore({ ...scope, scenario: 'revoked' })).status, 'revoked');
  await assert.rejects(readSyntheticStore({ ...scope, scenario: 'error' }));
  const abort = new AbortController();
  const task = readSyntheticStore({ ...scope, scenario: 'delayed' }, { signal: abort.signal });
  abort.abort(); await assert.rejects(task, { name: 'AbortError' });
});

function timedHarness() {
  const clocks = new Map(), pending = [], states = [];
  let id = 0;
  const controller = createStoreLoadController({ timeoutMs: 100, onChange: value => states.push(value),
    schedule(callback) { clocks.set(++id, callback); return id; }, cancel(key) { clocks.delete(key); },
    read(scope, { signal }) { return new Promise((resolve, reject) => pending.push({ signal, resolve, reject })); }
  });
  return { controller, pending, states, clocks, fire() { const callback = [...clocks.values()][0]; callback(); } };
}

test('deadline fails closed, aborts the mock and ignores late completion before a successful retry', async () => {
  const { controller, pending, states, clocks, fire } = timedHarness();
  const slow = controller.load(scope); fire(); await slow;
  assert.equal(pending[0].signal.aborted, true);
  assert.deepEqual(states.at(-1), { status: 'error', code: 'PREVIEW_READ_TIMEOUT' });
  assert.equal(clocks.size, 0);
  pending[0].resolve(response()); await Promise.resolve();
  assert.equal(states.at(-1).status, 'error');
  const retry = controller.load(scope); pending[1].resolve(response()); await retry;
  assert.equal(states.at(-1).status, 'ready'); assert.equal(clocks.size, 0);
});

test('deadline resources are removed on success, failure, replacement, clear and withdrawal', async () => {
  const { controller, pending, clocks } = timedHarness();
  const old = controller.load(scope); const next = controller.load(scope);
  assert.equal(clocks.size, 1); assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve(response()); pending[1].reject(new Error('PRIVATE')); await Promise.all([old,next]);
  assert.equal(clocks.size, 0);
  for (const action of ['clear','revoke']) {
    const task = controller.load(scope); assert.equal(clocks.size, 1);
    controller[action](); assert.equal(clocks.size, 0);
    pending.at(-1).resolve(response()); await task;
  }
  for (const timeoutMs of [0,-1,Infinity,30001,'100']) {
    assert.throws(()=>createStoreLoadController({ read:()=>{}, onChange:()=>{}, timeoutMs }), TypeError);
  }
});
