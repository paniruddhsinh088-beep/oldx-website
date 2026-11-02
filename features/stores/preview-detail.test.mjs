import test from 'node:test';
import assert from 'node:assert/strict';
import { planSyntheticDetailRead, projectSyntheticDetail } from './preview-detail.mjs';
import { createStoreLoadController } from './preview-load.mjs';
import { readSyntheticDetail } from './preview-adapter.mjs';
import { sampleStores, sampleListings } from './preview-fixtures.mjs';
const scope = { storeUid: 'demo-shop', productId: 'sample-1' };
const response = () => ({ status: 'published', store: { ...sampleStores[0], sellerUid: 'demo-shop', publicationStatus: 'published', phone: 'PRIVATE' },
  listing: { ...sampleListings[0], publicationStatus: 'published', email: 'PRIVATE', coords: { lat: 1 }, verified: true } });
const project = (value, request) => projectSyntheticDetail(value, { storeUid: request.storeUid, productId: request.productId });

test('bounded detail scope rejects invalid IDs and arbitrary query/collection overrides', () => {
  assert.deepEqual(planSyntheticDetailRead(scope), { ok: true, scope, maxStoreDocuments: 1, maxListingDocuments: 1 });
  for (const patch of [{ storeUid: '../private' }, { productId: '%2Fsecret' }, { productId: '' }, { productId: 'a'.repeat(129) },
    { productId: null }, { storeUid: {} }, { collection: 'products' }, { pageSize: 100 }, { publicationStatus: 'published' }]) {
    assert.equal(planSyntheticDetailRead({ ...scope, ...patch }).ok, false);
  }
  for (const value of [null, [], 'id', Object.create(scope)]) assert.equal(planSyntheticDetailRead(value).ok, false);
});

test('Store, listing and requested identity are independently checked before public projection', () => {
  const raw = response(), result = projectSyntheticDetail(raw, scope);
  assert.deepEqual(Object.keys(result).sort(), ['product','status','store']);
  assert.deepEqual(result.product, { id: 'sample-1', title: sampleListings[0].title, category: 'furniture', price: 1200, priceLabel: '₹1,200', available: true });
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(Object.hasOwn(result.product, 'verified'), false);
  raw.store.name = 'Changed'; assert.notEqual(result.store.name, 'Changed');
  for (const patch of [{ id: 'other' }, { sellerUid: 'other' }, { sellerUid: undefined }]) {
    assert.equal(projectSyntheticDetail({ ...response(), store: { ...response().store, ...patch } }, scope), null);
  }
  for (const patch of [{ id: 'other' }, { sellerUid: 'other' }, { title: '<img>' }, { basePrice: Infinity }, { createdAt: null }, { publicationStatus: undefined }]) {
    assert.equal(projectSyntheticDetail({ ...response(), listing: { ...response().listing, ...patch } }, scope), null);
  }
});

test('removed or unpublished Store/listing yields a uniform unavailable result without public/private details', () => {
  for (const publicationStatus of ['draft','pending_review','unpublished','suspended','deleted']) {
    for (const field of ['store','listing']) {
      const raw = response(); raw[field].publicationStatus = publicationStatus;
      assert.deepEqual(projectSyntheticDetail(raw, scope), { status: 'unavailable' });
    }
  }
  for (const raw of [{ ...response(), store: null }, { ...response(), listing: null }, { status: 'revoked', secret: 'PRIVATE' }]) {
    assert.deepEqual(projectSyntheticDetail(raw, scope), { status: 'unavailable' });
  }
  for (const raw of [null, [], {}, { ...response(), store: [] }, { ...response(), listing: {} }]) assert.equal(projectSyntheticDetail(raw, scope), null);
});

test('out-of-order detail completion and cancellation cannot resurrect an earlier product', async () => {
  const pending = [], states = [];
  const loader = createStoreLoadController({ project, onChange: s => states.push(s), read: (request, { signal }) => new Promise(resolve => pending.push({request,signal,resolve})) });
  const old = loader.load(scope), next = loader.load({ ...scope, productId: 'sample-2' });
  assert.equal(pending[0].signal.aborted, true); assert.deepEqual(states.at(-1), {status:'loading'});
  pending[1].resolve({ ...response(), listing: { ...sampleListings[1], publicationStatus:'published' } }); await next;
  assert.equal(states.at(-1).snapshot.product.id, 'sample-2');
  pending[0].resolve(response()); await old;
  assert.equal(states.at(-1).snapshot.product.id, 'sample-2');
  const third = loader.load(scope); loader.clear(); pending[2].resolve(response()); await third;
  assert.deepEqual(states.at(-1), {status:'idle'});
});

test('detail timeout and unavailable recovery use the existing lifecycle with no snapshot fallback', async () => {
  let tick; const pending = [], states = [];
  const loader = createStoreLoadController({ project, timeoutMs: 100, schedule: cb => { tick=cb;return 1; },cancel:()=>{},
    onChange: s=>states.push(s), read: ()=>new Promise(resolve=>pending.push(resolve)) });
  const slow = loader.load(scope); tick(); await slow;
  assert.deepEqual(states.at(-1), {status:'error',code:'PREVIEW_READ_TIMEOUT'});
  pending[0](response()); await Promise.resolve(); assert.equal(states.at(-1).status,'error');
  const gone = loader.load(scope); pending[1]({...response(),listing:null}); await gone;
  assert.deepEqual(states.at(-1),{status:'unavailable',snapshot:null});
  const retry = loader.load(scope); pending[2](response()); await retry;
  assert.equal(states.at(-1).snapshot.product.id,scope.productId);
});

test('offline detail adapter resolves only a single requested product and does not rely on catalogue pages', async () => {
  const raw = await readSyntheticDetail(scope);
  assert.equal(raw.listing.id, scope.productId); assert.equal(Object.hasOwn(raw,'records'),false);
  assert.equal(projectSyntheticDetail(raw,scope).status,'ready');
  const missing = {...scope,productId:'removed'};
  assert.equal(projectSyntheticDetail(await readSyntheticDetail(missing),missing).status,'unavailable');
  const abort = new AbortController(); const task = readSyntheticDetail({...scope,scenario:'delayed'},{signal:abort.signal});
  abort.abort(); await assert.rejects(task,{name:'AbortError'});
  await assert.rejects(readSyntheticDetail({...scope,productId:'../private'}));
});

test('cancelled detail callers settle promptly even when the mock ignores AbortSignal', async () => {
  for (const action of ['clear','revoke','replace']) {
    const pending = [], states = [];
    const loader = createStoreLoadController({ project, schedule:()=>1, cancel:()=>{}, onChange:s=>states.push(s),
      read:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})) });
    const old = loader.load(scope);
    let next;
    if (action==='replace') next=loader.load({...scope,productId:'sample-2'}); else loader[action]();
    const settled = await Promise.race([old.then(()=>true), new Promise(resolve=>setImmediate(()=>resolve(false)))]);
    // Clean up the active request before asserting, even if the regression fails.
    if (next) { pending[1].resolve({...response(),listing:{...sampleListings[1],publicationStatus:'published'}}); await next; }
    assert.equal(settled,true,action+' must not wait for an uncooperative adapter');
    const state=states.at(-1);
    pending[0].reject(new Error('PRIVATE LATE ERROR')); await Promise.resolve();
    assert.equal(states.at(-1),state,'late rejection cannot change current state');
  }
});
