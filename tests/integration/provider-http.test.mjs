import test from 'node:test';import assert from 'node:assert/strict';
import {createProviderHttpComposition} from '../../scripts/provider-http-composition.mjs';
import {parseBoundedJson} from '../../scripts/bounded-json.mjs';
import {fakeProviderTransactions} from './fake-provider-transactions.mjs';
const profile={displayName:'Sample',city:'Sample City',serviceArea:'Sample area',services:['Plumber'],description:'Private sample',experienceYears:2,available:true,languages:['en']};
const payload={requestId:'http-1',expectedRevision:0,profile};
const request=(body=JSON.stringify(payload),headers={})=>({method:'POST',headers:{authorization:'Bearer test.token.signature','content-type':'application/json',...headers},body});
function setup(overrides={}){const repository=fakeProviderTransactions();const counts={auth:0,rate:0};const config={enabled:true,verifyFirebaseToken:(token,context)=>{counts.auth++;assert.equal(token,'test.token.signature');assert.equal(context.checkRevoked,true);return {uid:'owner',privateClaim:'never return'};},resolveProviderRole:uid=>({uid,role:'provider',active:true}),consumeRateLimit:()=>{counts.rate++;return {allowed:true,retryAfterSeconds:0};},draft:{repository,providerIdForActor:()=> 'p1'},...overrides};return {http:createProviderHttpComposition(config),repository,counts};}
test('HTTP defaults off; method/content/JSON/size/schema errors precede token verification',async()=>{
 assert.equal((await createProviderHttpComposition().handle('draft.save',request())).status,503);const {http,counts}=setup();
 for(const [r,status] of [[{...request(),method:'GET'},405],[request('{}',{'content-type':'text/plain'}),415],[request('{'),400],[request('x'.repeat(16385)),413],[request(JSON.stringify({...payload,ownerUid:'forged'})),400],[request('{"requestId":"one","requestId":"two"}'),400]])assert.equal((await http.handle('draft.save',r)).status,status);
 assert.equal(counts.auth,0);assert.equal(counts.rate,0);
});
test('verified HTTP draft reuses atomic adapter and returns only minimal outcome; replay is stable',async()=>{
 const {http,repository}=setup();const response=await http.handle('draft.save',request());assert.equal(response.status,200);assert.deepEqual(response.body,{ok:true,status:'saved',providerId:'p1',revision:1});assert.match(response.headers['Cache-Control'],/no-store/);assert.equal(response.headers['X-Content-Type-Options'],'nosniff');assert.equal(JSON.stringify(response).includes('Private sample'),false);assert.equal(JSON.stringify(response).includes('test.token'),false);
 assert.equal((await http.handle('draft.save',request())).body.status,'replayed');assert.equal(repository.commits,1);
});
test('missing/invalid token, role mismatch, rate denial and unavailable enforcement fail closed',async()=>{
 const {http,repository}=setup();assert.equal((await http.handle('draft.save',request(undefined,{authorization:''}))).status,401);
 assert.equal((await setup({verifyFirebaseToken:()=>{throw new Error('private credential');}}).http.handle('draft.save',request())).status,401);
 assert.equal((await setup({resolveProviderRole:()=>({uid:'foreign',role:'provider',active:true})}).http.handle('draft.save',request())).status,403);
 const denied=await setup({consumeRateLimit:()=>({allowed:false,retryAfterSeconds:12})}).http.handle('draft.save',request());assert.equal(denied.status,429);assert.equal(denied.headers['Retry-After'],'12');
 for(const policy of [undefined,()=>null,()=>{throw new Error('private rate backend');}]){const s=setup({consumeRateLimit:policy});assert.equal((await s.http.handle('draft.save',request())).status,503);assert.equal(s.repository.commits,0);}
 assert.equal(repository.commits,0);
});
test('transaction permission/ownership stays authoritative and unknown commit outcomes are safe HTTP 202',async()=>{
 const s=setup();s.repository.change(state=>state.actors.owner.suspended=true);assert.equal((await s.http.handle('draft.save',request())).status,403);assert.equal(s.repository.commits,0);
 const lost=setup();lost.repository.loseAck=true;const unknown=await lost.http.handle('draft.save',request());assert.equal(unknown.status,202);assert.deepEqual(unknown.body,{ok:false,error:{code:'OUTCOME_UNKNOWN'},retrySameRequest:true});assert.equal((await lost.http.handle('draft.save',request())).body.status,'replayed');assert.equal(lost.repository.commits,1);
});
test('HTTP auth deadline/cancellation never starts a mutation and headers reject accessors/duplicates',async()=>{
 let expire,release;const s=setup({verifyFirebaseToken:()=>new Promise(r=>release=r),schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});const pending=s.http.handle('draft.save',request());await Promise.resolve();expire();assert.equal((await pending).status,504);release({uid:'owner'});await Promise.resolve();assert.equal(s.repository.commits,0);
 let evaluated=0;const headers={'content-type':'application/json'};Object.defineProperty(headers,'authorization',{enumerable:true,get(){evaluated++;return 'Bearer test.token.signature';}});assert.equal((await setup().http.handle('draft.save',{...request(),headers})).status,400);assert.equal(evaluated,0);assert.equal((await setup().http.handle('draft.save',request(undefined,{Authorization:'Bearer other.token.signature'}))).status,400);
 const abort=new AbortController();abort.abort();assert.equal((await setup().http.handle('draft.save',request(),{signal:abort.signal})).status,408);
});
test('bounded JSON rejects duplicate escaped keys, excessive depth/nodes, malformed UTF-8 and non-finite values',()=>{
 for(const body of ['{"x":1,"\\u0078":2}','{"__proto__":{}}','{"x":1e999}','{"x":'+ '['.repeat(8)+'0'+']'.repeat(8)+'}',new Uint8Array([0xff]),'[]','{"x":['+Array(33).fill('0').join(',')+']}'])assert.equal(parseBoundedJson(body).ok,false);
 assert.deepEqual(parseBoundedJson(new TextEncoder().encode('{"text":"ગુજરાતી हिन्दी","x":[true,false,null]}')).value,{text:'ગુજરાતી हिन्दी',x:[true,false,null]});
});
test('HTTP publication composes SDK transaction policy without allowing a member or forged body role to publish',async()=>{
 const {fakeFirestoreSdk,SDK_TEST_SCHEMA:schema}=await import('./fake-firestore-sdk.mjs');const {createIsolatedFirebaseProviderRepository}=await import('../../scripts/firebase-provider-repository.mjs');const f=fakeFirestoreSdk();f.seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:false});f.seed(schema.permissions,'owner',{uid:'owner',canPublish:false,canWithdraw:true,suspended:false});f.seed(schema.generations,'current',{value:0});const repository=createIsolatedFirebaseProviderRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema});
 const dependencies={draft:{repository,providerIdForActor:()=> 'p1'},publication:{repository,catalog:{services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample area'}]}}};const s=setup(dependencies);assert.equal((await s.http.handle('draft.save',request())).status,200);
 const command={requestId:'pub-1',expectedRevision:1,expectedGeneration:0,action:'publish'};assert.equal((await s.http.handle('publication.manage',request(JSON.stringify(command)))).status,403);
 f.seed(schema.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});assert.equal((await setup({...dependencies,resolveProviderRole:uid=>({uid,role:'member',active:true})}).http.handle('publication.manage',request(JSON.stringify(command)))).status,403);
 assert.equal((await s.http.handle('publication.manage',request(JSON.stringify({...command,role:'admin'})))).status,400);const applied=await s.http.handle('publication.manage',request(JSON.stringify(command)));assert.equal(applied.status,200);assert.deepEqual(applied.body,{ok:true,status:'applied',providerId:'p1',action:'publish',generation:1});assert.equal(Object.hasOwn(applied.body,'ownerUid'),false);
});

test('owner bootstrap HTTP privately restores v1 state and reconciles receipts without allocation or public leakage',async()=>{
 const {fakeFirestoreSdk}=await import('./fake-firestore-sdk.mjs');const {PROVIDER_V1_TEST_SCHEMA:schema,createProviderV1Integration}=await import('../../scripts/provider-schema-v1.mjs');const {createIsolatedFirebaseProviderRepository}=await import('../../scripts/firebase-provider-repository.mjs');
 const f=fakeFirestoreSdk();f.seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:false});f.seed(schema.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});f.seed(schema.generations,'current',{value:0});const repository=createIsolatedFirebaseProviderRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema});
 const catalog={version:1,stateCode:'GJ',services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample area'}]};const owner=createProviderV1Integration({enabled:true,authenticate:()=>({uid:'owner'}),repository,catalog,randomId:()=> 'opaque-candidate'});await owner.saveDraft(payload);
 const s=setup({bootstrap:{repository}});const read=await s.http.handle('owner.bootstrap',request(JSON.stringify({operation:'draft.save',requestId:'http-1'})));assert.equal(read.status,200);assert.equal(read.body.receipt.status,'committed');assert.equal(read.body.draft.description,'Private sample');assert.match(read.headers['Cache-Control'],/no-store/);assert.equal(Object.hasOwn(read.body,'ownerUid'),false);assert.equal(f.commits,1);
 assert.equal((await s.http.handle('owner.bootstrap',request(JSON.stringify({operation:null,requestId:null,ownerUid:'foreign'})))).status,400);
 const other=setup({bootstrap:{repository},verifyFirebaseToken:()=>({uid:'other'})});f.seed(schema.actors,'other',{uid:'other',canWrite:true,suspended:false});const foreign=await other.http.handle('owner.bootstrap',request(JSON.stringify({operation:null,requestId:null})));assert.equal(foreign.status,200);assert.equal(foreign.body.exists,false);assert.equal(JSON.stringify(foreign).includes('Private sample'),false);
 f.seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:true});assert.equal((await s.http.handle('owner.bootstrap',request(JSON.stringify({operation:null,requestId:null})))).status,403);
 assert.equal((await setup({bootstrap:{repository},consumeRateLimit:undefined}).http.handle('owner.bootstrap',request(JSON.stringify({operation:null,requestId:null})))).status,503);
});
