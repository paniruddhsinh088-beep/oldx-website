import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {buildServicePreviewLink} from '../../features/service-providers/preview-route.mjs';import {compressProviderPhoto} from '../../features/media/compress-provider-photo.mjs';
test('website share link keeps only safe website mode, never tokens or synthetic route fallback',()=>{const result=buildServicePreviewLink({pageUrl:'https://example.test/service-preview.html?mode=website&token=secret',origin:'https://example.test',providerId:'real-provider'});assert.equal(result.url,'https://example.test/service-preview.html?mode=website#provider/real-provider');});
test('website navigation preserves legacy preview and adds separate no-fixture Services entry',async()=>{const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');assert.match(html,/id="servicesHeaderLink" href="\.\/service-preview\.html\?mode=website#services"/);assert.match(html,/href="\.\/service-preview\.html" target="_blank"/);});
test('photo preparation rejects MIME mismatch, oversized files and cancelled operations before decode',async()=>{for(const file of [{type:'image/svg+xml',size:1,arrayBuffer:async()=>new ArrayBuffer(1)},{type:'image/png',size:4*1024*1024,arrayBuffer:()=>assert.fail('no read')},{type:'image/png',size:3,arrayBuffer:async()=>Uint8Array.of(1,2,3).buffer}])await assert.rejects(compressProviderPhoto(file,{createBitmap:()=>assert.fail('no decode')}));await assert.rejects(compressProviderPhoto(null,{signal:AbortSignal.abort()}));});

test('image preparation bounds decoded pixels and releases bitmap on cancellation',async()=>{
 const bytes=Uint8Array.of(255,216,255,0),file={type:'image/jpeg',size:bytes.length,arrayBuffer:async()=>bytes.buffer};let closed=0;
 await assert.rejects(compressProviderPhoto(file,{document:{createElement:()=>assert.fail('no canvas for oversized dimensions')},createBitmap:async()=>({width:9000,height:100,close:()=>closed++})}));assert.equal(closed,1);
 const controller=new AbortController();await assert.rejects(compressProviderPhoto(file,{signal:controller.signal,document:{createElement:()=>assert.fail('no cancelled draw')},createBitmap:async()=>{controller.abort();return {width:1,height:1,close:()=>closed++};}}));assert.equal(closed,2);
});

test('merged staging Rules proposal preserves deny-all and is never selected for deployment',async()=>{
 const config=JSON.parse(await readFile(new URL('../../firebase.json',import.meta.url),'utf8'));assert.equal(config.firestore,undefined);assert.equal(config.storage,undefined);
 for(const name of ['provider-merged-firestore.rules','provider-merged-storage.rules']){const rules=await readFile(new URL('../../docs/proposals/'+name,import.meta.url),'utf8');assert.match(rules,/allow read, write: if false;/);assert.doesNotMatch(rules,/allow[^;]+if true/);}
});

test('Provider client JPEG preparation is compatible with trusted profile size/dimension policy',async()=>{
 const {PROVIDER_PHOTO_PREPARATION}=await import('../../features/media/compress-provider-photo.mjs'),{getSurfacePolicy}=await import('../../scripts/image-upload-contract-policy.mjs');const policy=getSurfacePolicy('profile');assert.equal(PROVIDER_PHOTO_PREPARATION.maxDimension,policy.maxDimension);assert.equal(PROVIDER_PHOTO_PREPARATION.maxBytes,policy.maxBytes);
});
