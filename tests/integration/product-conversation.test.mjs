import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {productConversationAcceptance} from './product-conversation-acceptance.mjs';
import {createIsolatedProductConversationRepository} from '../../scripts/firebase-product-conversation-repository.mjs';
test('Product create publish discover private enquiry seller inbox response and withdrawal through injected SDK',async()=>{const f=fakeFirestoreSdk();f.seed('testOldxMarketPublicViews','product_withdrawn',{id:'withdrawn',kind:'product',category:'cars'});await productConversationAcceptance({sdk:f.sdk,db:f.db,seed:(...a)=>f.seed(...a),get:(...a)=>f.get(...a)});});
test('Product conversation defaults off and rejects production binding',async()=>{assert.equal((await createIsolatedProductConversationRepository().open()).code,'UNAVAILABLE');assert.throws(()=>createIsolatedProductConversationRepository({enabled:true,firestore:{app:{options:{projectId:'oldx-1c983'}}},sdk:{}}));});
import {createProductConversationHttp} from '../../scripts/product-conversation-http.mjs';
const wire=(body={role:'seller',limit:5})=>({method:'POST',headers:{authorization:'Bearer isolated.test.token','content-type':'application/json'},body:JSON.stringify(body)});
test('Product HTTP verifies revocation, derives identity and fails closed for missing rate enforcement',async()=>{
 let calls=0;const options={enabled:true,verifyFirebaseToken:(_token,context)=>{assert.equal(context.checkRevoked,true);return {uid:'verified'};},consumeRateLimit:()=>({allowed:true}),createRepository:({authenticate})=>({inbox:async()=>{calls++;assert.deepEqual(await authenticate(),{uid:'verified'});return {ok:true,items:[],bounded:true};}})};
 assert.equal((await createProductConversationHttp(options).handle('inbox',wire())).status,200);
 for(const rate of [undefined,()=>null,()=>({allowed:'yes'}),()=>{throw new Error('private quota backend');}])assert.equal((await createProductConversationHttp({...options,consumeRateLimit:rate}).handle('inbox',wire())).status,503);
 assert.equal((await createProductConversationHttp({...options,consumeRateLimit:()=>({allowed:false})}).handle('inbox',wire())).status,429);
 assert.equal((await createProductConversationHttp({...options,verifyFirebaseToken:()=>null}).handle('inbox',wire())).status,401);
 assert.equal((await createProductConversationHttp(options).handle('inbox',wire({role:'seller',limit:5,ownerUid:'foreign'}))).status,400);assert.equal(calls,1);
});
test('Product HTTP rejects malformed/oversize bodies and headers without reading getters; no private response fields',async()=>{
 let invoked=0;const http=createProductConversationHttp({enabled:true,verifyFirebaseToken:()=>({uid:'verified'}),consumeRateLimit:()=>({allowed:true}),createRepository:()=>({inbox:async()=>({ok:true,items:[{id:'x',productId:'p',revision:1,productRevision:1,role:'seller',ownerUid:'private'}],bounded:true})})});
 const request=wire();Object.defineProperty(request.headers,'authorization',{enumerable:true,get(){invoked++;return 'Bearer bad.token.value';}});assert.equal((await http.handle('inbox',request)).status,400);assert.equal(invoked,0);
 assert.equal((await http.handle('inbox',{...wire(),body:'{"role":"buyer","role":"seller","limit":5}'})).status,400);
 assert.equal((await http.handle('inbox',{...wire(),body:' '.repeat(16385)})).status,413);
 const response=await http.handle('inbox',wire());assert.equal(response.status,503);assert.equal(response.headers['Cache-Control'],'private, no-store');assert.deepEqual(response.body,{ok:false,error:{code:'UNAVAILABLE'}});assert.equal(JSON.stringify(response.body).includes('private'),false);assert.equal(JSON.stringify(response.body).includes('ownerUid'),false);
});
