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
