import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthenticatedPhotoClient} from '../../features/media/authenticated-photo-client.mjs';
import {createMandatoryPhotos} from '../../features/media/mandatory-photos.mjs';
const scope={uid:'owner',sessionId:'session',parentId:'parent',revision:1},imageId='image_12345678901234567890';
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const request={requestId:'request-1',kind:'product',parentId:'parent',expectedParentRevision:1,contentType:'image/webp',bytes};
const identity=s=>({...s,token:'synthetic.token.only'}),ok={status:200,body:{ok:true,state:'quarantined',imageId,revision:2,parentRevision:1}};
test('unknown upload retries resolve durable status with same key, no second dispatch',async()=>{
 let sends=0,reads=0;const p=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:async()=>{sends++;return {status:202,body:{retrySameRequest:true}};},sendCommand:async(op,r)=>{reads++;assert.equal(op,'status');assert.equal(r.requestId,'request-1');return ok;}});p.setScope(scope);
 assert.equal((await p.upload(request)).ok,false);assert.deepEqual(await p.upload(request),{ok:true,state:'quarantined',imageId});assert.equal(sends,1);assert.equal(reads,1);
});
test('scope switch aborts and rejects late responses; mismatched identity/default-off deny',async()=>{
 let release,signal;const p=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:async(_r,_b,auth)=>{signal=auth.signal;return new Promise(r=>release=r);}});p.setScope(scope);const pending=p.upload(request);await new Promise(r=>setTimeout(r,0));p.setScope({...scope,uid:'other'});assert.equal(signal.aborted,true);release(ok);assert.equal((await pending).ok,false);
 const wrong=createAuthenticatedPhotoClient({enabled:true,getToken:async()=>identity({...scope,uid:'other'}),sendUpload:()=>assert.fail('dispatch')});wrong.setScope(scope);assert.equal((await wrong.upload(request)).code,'AUTH_REQUIRED');assert.equal((await createAuthenticatedPhotoClient().upload(request)).ok,false);
});
test('refresh restores metadata only and recovers without original file or re-upload',async()=>{
 let sends=0;const client=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:async()=>{sends++;return ok;},sendCommand:async()=>ok});client.setScope(scope);
 const model=createMandatoryPhotos({enabled:true,kind:'product',upload:client.upload,recover:client.recover});model.setScope(scope);assert.equal(model.restoreReceipts([{requestId:'request-1'}]),true);const key=model.snapshot().items[0].key;assert.equal(await model.retry(key),true);assert.equal(sends,0);assert.deepEqual(model.references(),[{kind:'managed',imageId}]);assert.deepEqual(model.pendingReceipts(),[{requestId:'request-1'}]);model.setScope(null);client.setScope(null);assert.deepEqual(model.references(),[]);
});
test('unsettled, revoked or unavailable status never resends; cancelled recovery cannot restore photos',async()=>{
 for(const result of [{status:200,body:{ok:true,state:'uploading',parentRevision:1}},{status:401},{status:403},{status:503}]){
  let sends=0;const p=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:async()=>{sends++;return {status:202};},sendCommand:async()=>result});p.setScope(scope);await p.upload(request);assert.equal((await p.upload(request)).ok,false);assert.equal(sends,1);
 }
});
test('uploading status with an existing durable proof finalizes through recover, never sends bytes twice',async()=>{
 let sends=0;const commands=[];const p=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:async()=>{sends++;return {status:202};},sendCommand:async op=>{commands.push(op);return op==='status'?{status:200,body:{ok:true,state:'uploading',parentRevision:1}}:ok;}});p.setScope(scope);
 assert.equal((await p.upload(request)).ok,false);assert.equal((await p.upload(request)).ok,true);assert.equal(sends,1);assert.deepEqual(commands,['status','recover']);
 const restored=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:()=>assert.fail('no file upload on refresh'),sendCommand:async op=>op==='status'?{status:200,body:{ok:true,state:'uploading',parentRevision:1}}:ok});restored.setScope(scope);assert.equal((await restored.recover(request)).ok,true);
});
test('owner references restore saved managed IDs without making the draft dirty; late account reads are rejected',async()=>{
 let release;const p=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>identity(s),sendCommand:async op=>{assert.equal(op,'ownerPhotos');return new Promise(r=>release=r);}});p.setScope(scope);
 const pending=p.ownerReferences({kind:'product',parentId:'parent',expectedParentRevision:1});await new Promise(r=>setTimeout(r,0));release({status:200,body:{ok:true,parentId:'parent',parentRevision:1,photoRevision:1,photos:[{kind:'managed',imageId}]}});const result=await pending;assert.equal(result.ok,true);
 const model=createMandatoryPhotos({enabled:true,kind:'product'});model.setScope(scope);assert.equal(model.restoreReferences(result.photos),true);assert.equal(model.snapshot().changed,false);assert.equal(model.references()[0].imageId,imageId);
 const stale=p.ownerReferences({kind:'product',parentId:'parent',expectedParentRevision:1});await new Promise(r=>setTimeout(r,0));p.setScope({...scope,uid:'other'});release({status:200,body:{ok:true,parentId:'parent',parentRevision:1,photoRevision:1,photos:[{kind:'managed',imageId}]}});assert.equal((await stale).ok,false);
});

test('Provider media ports bind service, revisions and same-key recovery without public fields',async()=>{
 const {createAuthenticatedProviderPhotoClient}=await import('../../features/media/authenticated-photo-client.mjs');const calls=[];let uploaded=0;
 const client=createAuthenticatedProviderPhotoClient({enabled:true,getToken:async s=>identity(s),sendUpload:async r=>{calls.push(r);uploaded++;return {status:202};},sendCommand:async(op,r)=>{calls.push({op,...r});if(op==='status')return ok;if(op==='references')return {status:200,body:{ok:true,status:'saved',photoRevision:2}};return {status:200,body:{ok:true,parentId:'parent',parentRevision:1,photoRevision:1,photos:[]}};}});client.setScope(scope);
 const r={...request,kind:'provider',service:'મૂળ Cafe\u0301 हिन्दी'};assert.equal((await client.upload(r)).ok,false);assert.equal((await client.upload(r)).ok,true);assert.equal(uploaded,1);assert.equal(calls[0].service,r.service);assert.equal(calls[1].service,r.service);
 assert.equal((await client.ownerReferences(r)).photoRevision,1);assert.equal((await client.references({...r,expectedPhotoRevision:1,imageIds:[imageId]})).photoRevision,2);
 assert.equal((await client.references({...r,expectedPhotoRevision:1,imageIds:[imageId,imageId]})).code,'INVALID_REQUEST');assert.equal((await client.upload({...r,kind:'product'})).ok,false);assert.equal((await client.upload({...r,bytes:new Uint8Array(2*1024*1024+1)})).code,'INVALID_IMAGE');
 assert.equal((await client.references({...r,service:null,expectedPhotoRevision:1,imageIds:[imageId,'image_22345678901234567890']})).ok,false);
 client.setScope(null);assert.equal((await client.ownerReferences(r)).ok,false);
});
test('Provider HTTP transport is same-origin, bounded, authenticated and no redirect/unsigned path',async()=>{
 const {createProviderMediaHttpTransport}=await import('../../features/media/provider-media-http-client.mjs');let calls=0;
 const transport=createProviderMediaHttpTransport({enabled:true,origin:'https://preview.invalid',fetch:async(url,options)=>{calls++;assert.equal(url,'https://preview.invalid/api/staging/provider-media/upload');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,'Bearer fixture.token.only');assert.equal(options.body.get('intent').includes('provider'),true);assert.equal(options.body.has('upload_preset'),false);assert.equal(options.body.get('file').size,bytes.length);return Response.json({ok:true});}});
 assert.equal((await transport.sendUpload({...request,kind:'provider'},bytes,{credential:'fixture.token.only'})).status,200);assert.equal(calls,1);
 assert.equal((await transport.sendCommand('moderate',{}, {credential:'fixture.token.only'})).status,503);assert.equal(calls,1);
 assert.equal((await createProviderMediaHttpTransport().sendUpload(request,bytes,{})).status,503);
 const large=createProviderMediaHttpTransport({enabled:true,origin:'https://preview.invalid',fetch:async()=>new Response('x'.repeat(17000),{headers:{'content-type':'application/json'}})});assert.equal((await large.sendCommand('status',{}, {credential:'fixture.token.only'})).status,202);
 const timeout=createProviderMediaHttpTransport({enabled:true,timeoutMs:1,origin:'https://preview.invalid',fetch:()=>new Promise(()=>{})});assert.equal((await timeout.sendCommand('status',{}, {credential:'fixture.token.only'})).status,202);
});
