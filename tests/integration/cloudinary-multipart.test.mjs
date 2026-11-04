import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCloudinarySignedUpload} from '../../scripts/cloudinary-signed-upload.mjs';
import {createCloudinaryMultipartBridge} from '../../scripts/cloudinary-multipart-bridge.mjs';
import {createIsolatedMediaLifecycle} from '../../scripts/isolated-media-lifecycle.mjs';
import {createInMemoryMediaJournal} from '../../scripts/in-memory-media-journal.mjs';
const credentials={cloudName:'tfizvbzc',apiKey:'123456789',apiSecret:'synthetic-test-secret-only'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const input={bytes,publicId:'oldx/quarantine/abcdefghijklmnopqrst',resourceType:'image',deliveryType:'authenticated',overwrite:false};
const context=(actorUid='owner')=>({actorUid,signal:new AbortController().signal,checkpoint(){if(this.signal.aborted)throw Error('stopped');}});
function fixture(overrides={}){
 let clock=120000,allowed=true,calls=0,proof=null,lateProgress;
 const progress=[];
 const signer=createCloudinarySignedUpload({enabled:true,getCredentials:async()=>credentials,authorizeUpload:async()=>allowed,now:()=>clock});
 const options={enabled:true,mode:'isolated-test',signer,getCredentials:async()=>credentials,now:()=>clock,onProgress:n=>progress.push(n),
  sendMultipart:async(request,ctx)=>{
   calls++;assert.equal(request.url,'https://api.cloudinary.com/v1_1/tfizvbzc/image/upload');assert.equal(request.method,'POST');assert.equal(request.maxResponseBytes,16384);
   assert.deepEqual([...request.body.keys()].sort(),['api_key','file','overwrite','public_id','signature','timestamp','type']);
   const file=request.body.get('file');assert.equal(file.type,'image/webp');const uploaded=new Uint8Array(await file.arrayBuffer());assert.deepEqual(uploaded,bytes);
   assert.equal(request.body.get('overwrite'),'false');assert.equal(request.body.get('type'),'authenticated');
   lateProgress=ctx.onProgress;ctx.onProgress({loaded:5,total:bytes.length});ctx.onProgress({loaded:1,total:bytes.length});ctx.onProgress({loaded:bytes.length,total:bytes.length});ctx.onProgress({loaded:99,total:99});
   const v={asset_id:'asset-1',public_id:request.body.get('public_id'),version:120,resource_type:'image',type:'authenticated',format:'webp',bytes:uploaded.length,width:10,height:10};
   v.signature=hash('public_id='+v.public_id+'&version='+v.version+credentials.apiSecret);
   proof={assetId:v.asset_id,publicId:v.public_id,version:v.version,resourceType:'image',deliveryType:'authenticated',format:'webp',byteSize:uploaded.length,width:10,height:10,digest:hash(uploaded)};
   return {status:200,body:JSON.stringify(v)};
  },inspectAsset:async()=>proof,...overrides};
 return {options,create:()=>createCloudinaryMultipartBridge(options),progress,get calls(){return calls;},advance:()=>clock=180000,deny:()=>allowed=false,late:()=>lateProgress?.({loaded:bytes.length,total:bytes.length})};
}
test('private multipart upload verifies signature AND independently inspected bytes; receipt cannot be forged or cross-owned',async()=>{
 const f=fixture(),port=f.create(),r=await port.uploadProcessed(input,context());
 assert.deepEqual(r,{assetId:'asset-1'});const expected={publicId:input.publicId,deliveryType:'authenticated',byteSize:bytes.length};
 assert.equal(await port.verifyUploadResult(r,expected,context()),true);
 assert.equal(await port.verifyUploadResult({...r},expected,context()),false);
 assert.equal(await port.verifyUploadResult(r,expected,context('foreign')),false);
 assert.equal(await port.verifyUploadResult(r,{...expected,publicId:'foreign'},context()),false);
 assert.deepEqual(f.progress,[0,23,99,100]);f.late();assert.deepEqual(f.progress,[0,23,99,100]);
 f.advance();assert.equal(await port.verifyUploadResult(r,expected,context()),false);
});
test('default-off, production mode, missing inspection, unauthorized/invalid/oversized input never dispatch',async()=>{
 const f=fixture();
 for(const options of [{enabled:false},{mode:'production'},{inspectAsset:null}])await assert.rejects(fixture(options).create().uploadProcessed(input,context()),/Upload unconfirmed/);
 f.deny();await assert.rejects(f.create().uploadProcessed(input,context()));assert.equal(f.calls,0);
 for(const patch of [{bytes:new Uint8Array(3*1024*1024+1)},{bytes:new Uint8Array([1])},{deliveryType:'upload'},{publicId:'../private'},{overwrite:true}])await assert.rejects(fixture().create().uploadProcessed({...input,...patch},context()));
 const ctx=context();ctx.signal=AbortSignal.abort();await assert.rejects(fixture().create().uploadProcessed(input,ctx));
});
test('forged/mismatched signatures, type, size, dimensions and oversized/duplicate JSON fail closed',async()=>{
 for(const patch of [{signature:'0'.repeat(64)},{public_id:'oldx/quarantine/foreignabcdefghijklmnop'},{version:121},{type:'upload'},{resource_type:'raw'},{format:'svg'},{bytes:1},{width:9000},{height:0},{secure_url:'https://private.example'}]){
  const f=fixture(),send=f.options.sendMultipart;f.options.sendMultipart=async(...args)=>{const r=await send(...args);return {...r,body:JSON.stringify({...JSON.parse(r.body),...patch})};};await assert.rejects(f.create().uploadProcessed(input,context()),/Upload unconfirmed/);
 }
 for(const body of ['x'.repeat(16385),'{"bytes":1,"bytes":2}','not-json'])await assert.rejects(fixture({sendMultipart:async()=>({status:200,body})}).create().uploadProcessed(input,context()));
});
test('valid provider signature does not attest asset identity/digest; independent mismatches and expiry/revocation rejected',async()=>{
 for(const patch of [{assetId:'foreign'},{digest:'0'.repeat(64)},{byteSize:1},{deliveryType:'upload'},{version:121}]){
  const f=fixture(),inspect=f.options.inspectAsset;f.options.inspectAsset=async(...args)=>({...await inspect(...args),...patch});await assert.rejects(f.create().uploadProcessed(input,context()));
 }
 for(const action of ['advance','deny']){
  const f=fixture(),send=f.options.sendMultipart;f.options.sendMultipart=async(...args)=>{const result=await send(...args);f[action]();return result;};await assert.rejects(f.create().uploadProcessed(input,context()));assert.ok(!f.progress.includes(100));
 }
});
function composition(f){
 let allocation=0;
 const journal=createInMemoryMediaJournal({enabled:true,mode:'isolated-test',limits:{globalBytes:20000000,actorBytes:20000000,parentBytes:10000000,maxImages:5,maxEntries:30},allocateId:()=> 'image_abcdefghijklmnop_'+(++allocation),authorizeDelete:()=>true});
 const lifecycle=createIsolatedMediaLifecycle({enabled:true,mode:'isolated-test',authenticate:()=>({uid:'owner'}),authorize:()=>true,journal,processor:{decodeAndReencode:()=>({bytes,contentType:'image/webp',width:10,height:10,metadataStripped:true,contentScanned:true})},provider:f.create()});
 return {journal,lifecycle};
}
test('real in-memory journal composition prevents concurrent/duplicate sends and retains parent draft bytes',async()=>{
 const f=fixture(),{journal,lifecycle}=composition(f),request={requestId:'upload-1',surface:'product',parentId:'product-1'},draft={title:'મૂળ Cafe\u0301 हिन्दी',photos:[]},before=structuredClone(draft);
 const results=await Promise.all([lifecycle.upload(request,bytes),lifecycle.upload(request,bytes)]);assert.ok(results.some(r=>r.ok));assert.equal(f.calls,1);
 const replay=await lifecycle.upload(request,bytes);assert.equal(replay.ok,true);assert.equal(f.calls,1);assert.deepEqual(draft,before);
 assert.equal(journal.inspect({actorUid:'owner',imageId:replay.imageId},context()).published,false);
 assert.equal((await lifecycle.upload(request,new Uint8Array([2]))).code,'UPLOAD_NOT_AUTHORIZED');
});
test('ambiguous transport/verification failures retain reservation; same request never automatically uploads twice',async()=>{
 for(const options of [{sendMultipart:async()=>{throw Error('private secret');}},{inspectAsset:async()=>null}]){
  const f=fixture(options);let attempts=0;const send=f.options.sendMultipart;f.options.sendMultipart=(...args)=>{attempts++;return send(...args);};
  const {lifecycle,journal}=composition(f),request={requestId:'upload-1',surface:'product',parentId:'product-1'};
  const result=await lifecycle.upload(request,bytes);assert.equal(result.code,'OUTCOME_UNKNOWN');assert.equal(JSON.stringify(result).includes('private secret'),false);
  assert.equal((await lifecycle.upload(request,bytes)).code,'OUTCOME_UNKNOWN');assert.equal(attempts,1);assert.equal(journal.quota('owner',context()).images,1);
 }
});
test('cancellation during response prevents attach and ignores late progress',async()=>{
 const controller=new AbortController(),f=fixture(),send=f.options.sendMultipart;
 f.options.sendMultipart=async(...args)=>{const result=await send(...args);controller.abort();return result;};
 const {lifecycle}=composition(f),request={requestId:'upload-1',surface:'product',parentId:'product-1'};
 assert.equal((await lifecycle.upload(request,bytes,{signal:controller.signal})).code,'OUTCOME_UNKNOWN');f.late();assert.ok(!f.progress.includes(100));
});
