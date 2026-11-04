import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketplaceFetchHandler} from '../../functions/staging-marketplace/vercel-handler.mjs';
import {createStagingHandler} from '../../functions/staging-marketplace/bootstrap.mjs';
const env={OLDX_STAGING_COMMANDS_ENABLED:'true',VERCEL_ENV:'preview',OLDX_FIREBASE_ENV:'staging',OLDX_FIREBASE_PROJECT_ID:'oldx-staging',OLDX_RATE_WINDOW_MS:'60000',OLDX_RATE_ACTOR_LIMIT:'10',OLDX_RATE_GLOBAL_LIMIT:'60'};
const request=(body='{}',headers={},method='POST')=>new Request('https://preview.invalid/api/staging/marketplace/save',{method,headers:{'Content-Type':'application/json',...headers},...(method==='POST'?{body}:{})});
test('default and forbidden environment gates never initialize SDK or read credentials',async()=>{
 for(const value of [{},{...env,VERCEL_ENV:'production'},{...env,OLDX_FIREBASE_PROJECT_ID:'oldx-1c983'},{...env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8088'},{...env,OLDX_STAGING_PUBLICATION_ENABLED:'true'}]){
  let calls=0;const h=createStagingHandler({operation:'save',env:value,loadSdk:async()=>{calls++;throw Error('secret');}});
  assert.equal((await h.fetch(request())).status,503);assert.equal(calls,0);
 }
});
test('all three inactive templates load without SDK initialization or endpoints',async()=>{
 for(const op of ['save','owner','archive']){const {default:h}=await import(`../../deploy/staging-marketplace/${op}.mjs`);assert.equal((await h.fetch(request())).status,503);}
});
test('bounded raw JSON preserves duplicate keys and Unicode for trusted HTTP parser',async()=>{
 let seen;const h=createMarketplaceFetchHandler({operation:'save',options:{enabled:true},loadRuntime:async()=>({handle:async(path,value,context)=>{seen={path,value,context};return {status:401,headers:{'Cache-Control':'private, no-store'},body:{ok:false,error:{code:'AUTH_REQUIRED'}}};}})});
 const body='{"text":"ગુજરાતી हिन्दी","text":"unchanged"}';const r=await h.fetch(request(body));assert.equal(r.status,401);assert.equal(seen.value.body,body);assert.equal(seen.path,'/api/staging/marketplace/save');assert.ok(seen.context.signal instanceof AbortSignal);assert.equal(r.headers.get('cache-control'),'private, no-store');
});
test('method, content type, claimed and actual oversize rejected before runtime',async()=>{
 let calls=0;const h=createMarketplaceFetchHandler({operation:'save',options:{enabled:true},loadRuntime:async()=>{calls++;throw Error('secret');}});
 for(const [r,status] of [[request('{}',{},'GET'),405],[request('{}',{'content-type':'text/plain'}),415],[request('{}',{'content-length':'999999'}),413],[request('x'.repeat(32769)),413],[request('{}',{'content-encoding':'gzip'}),415]])assert.equal((await h.fetch(r)).status,status);
 assert.equal(calls,0);
});
test('slow body deadline cancels and never initializes runtime',async()=>{
 let calls=0;const stream=new ReadableStream({start(){}}),h=createMarketplaceFetchHandler({operation:'save',options:{enabled:true},bodyTimeoutMs:5,loadRuntime:async()=>{calls++;}});
 const r=await h.fetch(new Request('https://preview.invalid',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'}));assert.equal(r.status,408);assert.equal(calls,0);
});
test('malformed UTF8 and pre-aborted body fail closed',async()=>{
 let calls=0;const h=createMarketplaceFetchHandler({operation:'save',options:{enabled:true},loadRuntime:async()=>{calls++;}});
 assert.equal((await h.fetch(new Request('https://preview.invalid',{method:'POST',headers:{'content-type':'application/json'},body:new Uint8Array([0xff])}))).status,400);
 const c=new AbortController();c.abort();assert.equal((await h.fetch(new Request('https://preview.invalid',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:c.signal}))).status,408);assert.equal(calls,0);
});
test('SDK failures are sanitized and initialization is retried without logging',async()=>{
 let calls=0;const h=createStagingHandler({operation:'save',env,loadSdk:async()=>{calls++;throw Error('credential secret');}});
 for(let i=0;i<2;i++){const r=await h.fetch(request());assert.equal(r.status,503);assert.ok(!(await r.text()).includes('secret'));}assert.equal(calls,2);
});
test('route packaging manifest resolves server imports and installs no API routes',async()=>{
 const {stagingMarketplaceRouteArtifacts}=await import('../../functions/staging-marketplace/route-artifacts.mjs');
 const {existsSync}=await import('node:fs');const {resolve,dirname}=await import('node:path');
 const entries=stagingMarketplaceRouteArtifacts();assert.equal(Object.keys(entries).length,3);
 for(const [path,source] of Object.entries(entries)){
  assert.ok(!existsSync(path));const relative=/from '([^']+)'/.exec(source)[1];assert.ok(existsSync(resolve(dirname(path),relative)));assert.ok(source.includes('env:process.env'));
 }
});
test('SDK startup is bounded and cannot hand off a timed-out request',async()=>{
 let calls=0;const h=createMarketplaceFetchHandler({operation:'save',options:{enabled:true},bodyTimeoutMs:5,loadRuntime:async()=>{calls++;return new Promise(()=>{});}});
 assert.equal((await h.fetch(request())).status,408);assert.equal(calls,1);
});
