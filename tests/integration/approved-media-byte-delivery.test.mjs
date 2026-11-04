import test from 'node:test';import assert from 'node:assert/strict';
import {createApprovedMediaByteDelivery} from '../../scripts/approved-media-byte-delivery.mjs';
const create=options=>createApprovedMediaByteDelivery({consumeRateLimit:()=>({allowed:true}),...options});
const imageId='image_abcdefghijklmnopqrst',bytes=new Uint8Array([255,216,255,1]);
const request={kind:'product',parentId:'product-1',expectedParentRevision:2,expectedPhotoRevision:1,imageId};
function fixture(options={}){
 let active=true,version=1,reads=0;const contract={publicPhotos:async()=>({ok:true,parentId:request.parentId,parentRevision:2,photoRevision:1,photos:active?[{imageId,derivativeId:'approved-1',version}]:[]})};
 const reader=async r=>{reads++;assert.equal(r.maxBytes,3*1024*1024);return {derivativeId:r.derivativeId,version:r.version,contentType:'image/jpeg',bytes};};
 const port=create({enabled:true,contract,readApprovedDerivative:reader,...options});
 return {port,contract,reader,revoke:()=>active=false,replace:()=>version++,get reads(){return reads;}};
}
test('only current approved derivative bytes leave the server, with no public cache or credential/URL',async()=>{
 const f=fixture(),r=await f.port.read(request);assert.equal(r.ok,true);assert.deepEqual(r.bytes,bytes);assert.notEqual(r.bytes,bytes);assert.equal(r.headers['Content-Type'],'image/jpeg');assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['X-Content-Type-Options'],'nosniff');assert.equal(JSON.stringify(r).includes('approved-1'),false);
});
test('withdrawal/replacement during provider read never releases stale bytes',async()=>{
 for(const action of ['revoke','replace']){const f=fixture();const port=create({enabled:true,contract:f.contract,readApprovedDerivative:async r=>{const v=await f.reader(r);f[action]();return v;}});assert.equal((await port.read(request)).ok,false);}
});
test('disabled/private Chat/forged scope/foreign image cannot invoke the provider',async()=>{
 assert.equal((await createApprovedMediaByteDelivery().read(request)).ok,false);const f=fixture();
 for(const r of [{...request,kind:'chat'},{...request,imageId:'foreign_abcdefghijklmnop'},{...request,expectedParentRevision:3},{...request,parentId:'../x'},{...request,url:'https://private'}])assert.equal((await f.port.read(r)).ok,false);
 assert.equal(f.reads,0);
});
test('mismatched, oversized, script/unsafe MIME and missing inspection fail closed',async()=>{
 for(const patch of [{derivativeId:'foreign'},{version:2},{contentType:'image/svg+xml'},{contentType:'text/html'},{bytes:new Uint8Array([1,2,3])},{bytes:new Uint8Array(3*1024*1024+1)}]){
  const f=fixture(),port=create({enabled:true,contract:f.contract,readApprovedDerivative:async r=>({...await f.reader(r),...patch})});assert.equal((await port.read(request)).ok,false);
 }
 assert.equal((await create({enabled:true,contract:{}}).read(request)).ok,false);
});
test('cancellation/timeouts redact provider errors, no fallback URL or bytes',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();assert.equal((await f.port.read(request,{signal:controller.signal})).ok,false);assert.equal(f.reads,0);
 const port=create({enabled:true,contract:f.contract,timeoutMs:50,readApprovedDerivative:()=>new Promise(()=>{})});assert.deepEqual(await port.read(request),{ok:false,code:'MEDIA_UNAVAILABLE'});
 const failed=create({enabled:true,contract:f.contract,readApprovedDerivative:()=>{throw Error('private provider credential');}});assert.equal(JSON.stringify(await failed.read(request)).includes('credential'),false);
});

test('missing or denied global/edge rate enforcement cannot reach the provider',async()=>{
 const f=fixture();assert.equal((await createApprovedMediaByteDelivery({enabled:true,contract:f.contract,readApprovedDerivative:f.reader}).read(request)).ok,false);
 assert.equal((await create({enabled:true,contract:f.contract,readApprovedDerivative:f.reader,consumeRateLimit:()=>({allowed:false})}).read(request)).ok,false);assert.equal(f.reads,0);
});
