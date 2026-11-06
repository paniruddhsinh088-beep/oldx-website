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
test('bounded Product snapshots never delete saved IDs and stale callbacks cannot overwrite newer data',()=>{
 const listeners=[],alerts=[];const context={db:{collection:name=>{assert.equal(name,'products');return {orderBy:()=>({limit:()=>({onSnapshot:(next,error)=>{listeners.push({next,error});return ()=>{};}})})};}},document:{getElementById:()=>({style:{}})},localStorage:{getItem(){throw Error('A partial page cannot clean saved IDs');}},window:{currentUser:null},console:{error(){}},showCustomAlert:(...v)=>alerts.push(v),renderProducts(){},renderRecentlyViewed(){},handleHashChange(){}};
 runInNewContext('let productsReadGeneration=0,isFetchingProducts=false,hasMoreProducts=true,productLimit=12,productsUnsubscribe=null,products=[];'+section('function listenToProductsFromFirebase()', '// Initial fetch call')+';this.listen=listenToProductsFromFirebase;this.rows=()=>products;',context);
 context.listen();context.listen();const snapshot={docs:[1],forEach:fn=>fn({id:'canonical',data:()=>({docId:'forged',title:'Current'})})};listeners[1].next(snapshot);assert.equal(context.rows()[0].docId,'canonical');listeners[0].next({docs:[],forEach(){}});listeners[0].error(Error('old'));assert.equal(context.rows()[0].title,'Current');assert.equal(alerts.length,0);
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
 const user={uid:'owner'},header={style:{}},viewed={uid:'public-current',shopName:'Public'};let resolve;
 const context={window:{currentUser:user},document:{getElementById:()=>header},db:{collection:()=>({doc:()=>({get:()=>new Promise(r=>resolve=r)})})}};
 runInNewContext('let currentStoreData=null;'+section('function refreshStoreHeader(user)', 'function handleStoreHeaderClick()')+';this.refresh=refreshStoreHeader;this.set=v=>currentStoreData=v;this.current=()=>currentStoreData;',context);context.set(viewed);context.refresh(user);resolve({exists:true,data:()=>({uid:'forged'})});await Promise.resolve();assert.equal(context.current(),viewed);assert.match(header.innerHTML,/My Store/);
});

test('opening saved/recent views does not persist deletion of records outside the loaded window',()=>{
 const nodes=new Map(),context={auth:{currentUser:{uid:'owner'}},window:{currentUser:null},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{style:{}});return nodes.get(id);}},localStorage:{getItem:()=>JSON.stringify(['far-item']),setItem(){throw Error('Partial query cannot prune user cache');}},getSavedAdsStorageKey:()=> 'saved',unloadedSavedAdsMessage:()=> 'outside loaded window'};
 runInNewContext('let products=[];'+section('function openCartModal()', 'function removeFromCart(')+section('function renderRecentlyViewed()', 'function handleHashChange()')+';this.saved=openCartModal;this.recent=renderRecentlyViewed;',context);context.saved();context.recent();assert.match(nodes.get('cartItemsContainer').innerHTML,/outside loaded window/);
});
