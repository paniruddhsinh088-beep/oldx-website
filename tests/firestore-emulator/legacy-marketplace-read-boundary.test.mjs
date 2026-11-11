import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../../index.html',import.meta.url),'utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function pager(){
 const requests=[],button={},grid={},filters=[];const context={document:{getElementById:id=>id==='storeProductsGrid'?grid:{querySelector:()=>button}},storeCatalogueCopy:key=>key,filterStoreProducts:()=>filters.push(1),window:{activeStoreCategoryFilter:'all'},firebase:{firestore:{FieldPath:{documentId:()=> '__name__'}}},db:{collection:name=>{const request={name};const query={where:(...v)=>{request.where=v;return query;},orderBy:(...v)=>{request.order=v;return query;},limit:n=>{request.limit=n;return query;},startAfter:cursor=>{request.cursor=cursor;return query;},get:()=>new Promise((resolve,reject)=>requests.push({...request,resolve,reject}))};return query;}}};
 runInNewContext('let storeCatalogueState=null,storeCatalogueGeneration=0,currentStoreProductsCache=[];'+section('async function loadStoreCataloguePage(state)', 'function filterStoreProducts(')+';this.page=loadStoreCataloguePage;this.scope=s=>{storeCatalogueState=s;storeCatalogueGeneration=s.generation;currentStoreProductsCache=[];};this.rows=()=>currentStoreProductsCache;',context);
 const state={generation:1,ownerUid:'owner',cursor:null,hasMore:true,loading:false};context.scope(state);return {context,state,requests,button,grid};
}
const docs=(n,prefix='item')=>Array.from({length:n},(_,i)=>({id:prefix+i,data:()=>({sellerUid:'owner',docId:'forged',title:'મૂળ हिन्दी '+i})}));
test('Store pages are bounded, cursor-based, single-flight and pin document identity',async()=>{
 const f=pager(),first=f.context.page(f.state);await f.context.page(f.state);assert.equal(f.requests.length,1);assert.equal(f.requests[0].limit,24);assert.equal(f.requests[0].order[0],'__name__');assert.equal(f.requests[0].where[2],'owner');const firstDocs=docs(24);f.requests[0].resolve({docs:firstDocs});await first;assert.equal(f.context.rows().length,24);assert.equal(f.context.rows()[0].docId,'item0');
 const next=f.context.page(f.state);assert.equal(f.requests[1].cursor,firstDocs[23]);f.requests[1].resolve({docs:[...docs(1),...docs(1,'next')]});await next;assert.equal(f.context.rows().length,25);assert.equal(f.state.hasMore,false);assert.equal(f.button.hidden,true);await f.context.page(f.state);assert.equal(f.requests.length,2);
});
test('foreign/oversized pages and failures do not advance cursor, leak rows or prevent retry',async()=>{
 for(const rows of [docs(25),[{id:'foreign',data:()=>({sellerUid:'other',phone:'private'})}]]){const f=pager(),p=f.context.page(f.state);f.requests[0].resolve({docs:rows});await p;assert.equal(f.context.rows().length,0);assert.equal(f.state.cursor,null);assert.equal(f.button.textContent,'retry');assert.equal(f.button.disabled,false);const retry=f.context.page(f.state);f.requests[1].resolve({docs:docs(1)});await retry;assert.equal(f.context.rows().length,1);}
});
test('late success/failure from a previous Store scope cannot populate the next catalogue',async()=>{
 for(const fail of [false,true]){const f=pager(),p=f.context.page(f.state);const replacement={generation:2,ownerUid:'next',hasMore:true,loading:false,cursor:null};f.context.scope(replacement);f.button.textContent='new';if(fail)f.requests[0].reject(Error('private error'));else f.requests[0].resolve({docs:docs(1)});await p;assert.equal(f.context.rows().length,0);assert.equal(f.button.textContent,'new');}
});
test('bounded Product pages never delete saved IDs and stale completions cannot overwrite newer data',async()=>{
 const {feedHarness,document}=await import('../integration/legacy-performance-harness.mjs');const pending=[],f=feedHarness(plan=>new Promise(resolve=>pending.push({plan,resolve})));
 const old=f.start(),current=f.start();pending[2].resolve({docs:[document('canonical',{docId:'forged',title:'Current',createdAt:{seconds:1}})]});pending[3].resolve({docs:[]});await current;pending[0].resolve({docs:[]});pending[1].resolve({docs:[]});await old;assert.equal(f.rows()[0].docId,'canonical');assert.equal(f.rows()[0].title,'Current');
});
test('out-of-order public Store document reads cannot replace current owner or trust stored uid',async()=>{
 const requests=[],rendered=[],nodes=new Map();const context={document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{style:{}});return nodes.get(id);}},window:{currentUser:null},db:{collection:()=>({doc:uid=>({get:()=>new Promise((resolve,reject)=>requests.push({uid,resolve,reject}))})})},renderStorePublicContent:data=>rendered.push(data),console:{error(){}}};
 runInNewContext('let storePageReadGeneration=0,storeCatalogueGeneration=0,storeCatalogueState=null,currentStoreData=null,currentStoreProductsCache=[],publicStoreOwnerUid=null;'+section('async function openPublicStorePage(ownerUid)', 'function renderStorePublicContent(')+';this.open=openPublicStorePage;',context);
 const old=context.open('old'),next=context.open('current');requests[1].resolve({exists:true,data:()=>({uid:'forged',shopName:'Current'})});await next;requests[0].resolve({exists:true,data:()=>({shopName:'Old'})});await old;assert.equal(rendered.length,1);assert.equal(rendered[0].uid,'current');assert.equal(nodes.get('storePageHeading').textContent,'Current');
});

test('legacy public badges and curated promotion shelf never infer approval from seller fields',()=>{
 const card=section('function createProductCard(', '    </script>');
 assert.doesNotMatch(card,/★ VERIFIED|p\.isShopVerified|p\.isFeatured/);assert.doesNotMatch(source,/OldX Verified Store Page/);assert.match(source,/shopBadge\.style\.display = 'none'/);assert.match(source,/const featuredItems = \[\]/);
});

test('header Store lookup cannot replace the Store currently being viewed or its sharing identity',async()=>{
 const label={dataset:{}},icon={};
 const user={uid:'owner'},header={querySelector:selector=>({'[data-i18n]':label,i:icon})[selector]},viewed={uid:'public-current',shopName:'Public'};let resolve;
 const context={window:{currentUser:user},document:{getElementById:id=>id==='storeHeaderBtn'?header:null},translateHomepageLabels:()=>{},db:{collection:()=>({doc:()=>({get:()=>new Promise(r=>resolve=r)})})}};
 runInNewContext('let currentStoreData=null;'+section('function refreshStoreHeader(user)', 'function handleStoreHeaderClick()')+';this.refresh=refreshStoreHeader;this.set=v=>currentStoreData=v;this.current=()=>currentStoreData;',context);context.set(viewed);context.refresh(user);resolve({exists:true,data:()=>({uid:'forged'})});await Promise.resolve();assert.equal(context.current(),viewed);assert.equal(label.textContent,'My Store');assert.equal(label.dataset.i18n,'market.home.myStore');
});

test('opening saved/recent views does not persist deletion of records outside the loaded window',()=>{
 const nodes=new Map(),context={auth:{currentUser:{uid:'owner'}},window:{currentUser:null},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{style:{}});return nodes.get(id);}},localStorage:{getItem:()=>JSON.stringify(['far-item']),setItem(){throw Error('Partial query cannot prune user cache');}},getSavedAdsStorageKey:()=> 'saved',unloadedSavedAdsMessage:()=> 'outside loaded window'};
 runInNewContext('let products=[];'+section('function openCartModal()', 'function removeFromCart(')+section('function renderRecentlyViewed()', 'function handleHashChange()')+';this.saved=openCartModal;this.recent=renderRecentlyViewed;',context);context.saved();context.recent();assert.match(nodes.get('cartItemsContainer').innerHTML,/outside loaded window/);
});

function savedAdsFixture() {
 const cache = new Map();
 const alerts = [];
 const renders = [];
 const listeners = [];
 const fixture = { cache, alerts, renders, listeners, ads: [], writes: 0, transactions: 0 };
 const snapshot = () => ({ exists: true, data: () => ({ savedAds: fixture.ads }) });
 const user = { uid: 'owner' };
 const context = {
  window: { currentUser: user }, auth: { currentUser: user },
  localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) },
  document: { documentElement: { lang: 'en' }, getElementById: () => ({ style: { display: 'flex' } }) },
  console: { log() {} }, showCustomAlert: (...args) => alerts.push(args), triggerPushNotification() {},
  updateProfileDetails: () => renders.push('profile'), renderProducts: () => renders.push('products'),
  renderRecentlyViewed: () => renders.push('recent'), openCartModal: () => renders.push('saved'),
  db: {
   collection: () => ({ doc: uid => ({ uid, onSnapshot: callback => { listeners.push(callback); return () => {}; } }) }),
   async runTransaction(callback) {
    fixture.transactions++;
    const attempt = async () => {
     let update;
     const result = await callback({ get: async () => snapshot(), set: (ref, patch) => { update = patch.savedAds; } });
     return { result, update };
    };
    if (fixture.fail) throw Error('write unavailable');
    let { result, update } = await attempt();
    if (fixture.beforeRetry) {
     fixture.beforeRetry();
     ({ result, update } = await attempt());
    }
    if (update) {
     fixture.ads = JSON.parse(JSON.stringify(update));
     fixture.writes++;
    }
    return result;
   }
  }
 };
 runInNewContext('let userSavedAdsUnsubscribe, savedAdsGuestImport, currentProduct; const pendingSavedAds=new Set(), products=[];'
  + section('function getSavedAdsStorageKey()', 'function triggerPushNotification(')
  + section('async function saveAdMembership(', 'function toggleCartCurrentProduct()')
  + section('function removeFromCart(', 'function closeCartModal()'), context);
 return Object.assign(fixture, { context, user, snapshot });
}

test('Saved Ads sign-in uses the owner listener without replaying stale cache or repainting on unrelated changes', () => {
 const signIn = section('auth.onAuthStateChanged(user =>', 'startGlobalUnreadMessagesListener(user.uid);');
 assert.match(signIn, /startRealtimeSavedAdsSync\(user\);\s*importGuestSavedAds\(user\);/);
 assert.doesNotMatch(signIn, /savedAds:\s*|oldx_saved_ads_/);
 const { cache, context, listeners, renders, snapshot, user } = savedAdsFixture();
 cache.set('oldx_saved_ads_owner', '["previously-removed"]');
 context.startRealtimeSavedAdsSync(user);
 listeners[0](snapshot());
 listeners[0](snapshot());
 assert.equal(cache.get('oldx_saved_ads_owner'), '[]');
 assert.deepEqual(renders, ['profile', 'products', 'recent', 'saved']);
 context.auth.currentUser = context.window.currentUser = { uid: 'next' };
 listeners[0]({ exists: true, data: () => ({ savedAds: ['old-owner-item'] }) });
 assert.equal(cache.has('oldx_saved_ads_next'), false);
 assert.equal(cache.get('oldx_saved_ads_owner'), '[]');
});

test('guest Saved Ads import retains legacy IDs and objects and clears the guest cache only after commit', async () => {
 const f = savedAdsFixture();
 const guest = '["same",{"docId":"guest","title":"Legacy ad"}]';
 f.cache.set('oldx_saved_ads_guest', guest);
 f.ads = ['same', 'remote'];
 f.fail = true;
 await f.context.importGuestSavedAds(f.user);
 assert.equal(f.cache.get('oldx_saved_ads_guest'), guest);
 f.fail = false;
 await f.context.importGuestSavedAds(f.user);
 assert.deepEqual(f.ads, ['same', 'remote', { docId: 'guest', title: 'Legacy ad' }]);
 assert.equal(f.cache.has('oldx_saved_ads_guest'), false);
 await f.context.importGuestSavedAds(f.user);
 assert.equal(f.transactions, 2);
});

test('Saved Ads retry keeps concurrent changes and failed removal leaves the confirmed UI state intact', async () => {
 const f = savedAdsFixture();
 f.ads = ['existing'];
 f.beforeRetry = () => { f.ads = ['existing', 'other-device']; };
 f.context.startRealtimeSavedAdsSync(f.user);
 f.listeners[0](f.snapshot());
 const add = f.context.toggleCartProduct('new');
 await f.context.toggleCartProduct('new');
 assert.equal(f.alerts.length, 0);
 await add;
 assert.deepEqual(f.ads.map(item => item.docId || item), ['existing', 'other-device', 'new']);
 assert.equal(f.transactions, 1);
 f.listeners[0](f.snapshot());
 const confirmed = f.cache.get('oldx_saved_ads_owner');
 f.fail = true;
 await f.context.removeFromCart('new');
 assert.equal(f.cache.get('oldx_saved_ads_owner'), confirmed);
 assert.equal(f.alerts.at(-1)[2], 'error');
 f.fail = false;
 f.beforeRetry = null;
 await f.context.removeFromCart('new');
 assert.deepEqual(f.ads, ['existing', 'other-device']);
 assert.equal(f.writes, 2);
});
