import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCloudinaryHttpTransport} from '../../scripts/cloudinary-http-transport.mjs';
import {createCloudinarySignedUpload} from '../../scripts/cloudinary-signed-upload.mjs';
import {createCloudinaryMultipartBridge} from '../../scripts/cloudinary-multipart-bridge.mjs';
import {createApprovedMediaByteDelivery} from '../../scripts/approved-media-byte-delivery.mjs';
const credentials={cloudName:'tfizvbzc',apiKey:'123456789',apiSecret:'synthetic-credentials-not-real'};
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const identity={assetId:'asset-1',publicId:'oldx/quarantine/abcdefghijklmnopqrst',version:120};
const input={bytes,publicId:identity.publicId,resourceType:'image',deliveryType:'authenticated',overwrite:false};
const metadata={asset_id:identity.assetId,public_id:identity.publicId,version:identity.version,resource_type:'image',type:'authenticated',format:'webp',bytes:bytes.length,width:10,height:10};
const ctx=()=>({actorUid:'owner',deadlineAt:125000,signal:new AbortController().signal,checkpoint(){assert.ok(!this.signal.aborted);}});
const json=(value,status=200)=>Response.json(value,{status});
function fixture(patch={}){
 let calls=[],allowed=true,removed=false;const options={enabled:true,mode:'isolated-test',now:()=>120000,getCredentials:async()=>credentials,authorizeAsset:async()=>allowed,resolveDerivative:async()=>({...identity,digest:hash(bytes)}),fetchImpl:async(url,init)=>{
  calls.push({url,init});assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
  if(url.includes('/image/upload'))return json({...metadata,signature:hash(`public_id=${identity.publicId}&version=120${credentials.apiSecret}`),secure_url:'https://ignored.invalid',tags:[]});
  if(init.method==='DELETE'){removed=true;return json({deleted:{'asset-1':'deleted'},partial:false});}
  if(url.includes('/resources/')){assert.equal(init.headers.Authorization,'Basic '+Buffer.from(credentials.apiKey+':'+credentials.apiSecret).toString('base64'));return removed?json({error:{message:'not found'}},404):json({...metadata,secure_url:'https://forged.invalid'});}
  assert.ok(url.startsWith('https://res.cloudinary.com/tfizvbzc/image/authenticated/s--'));assert.ok(url.endsWith('/v120/'+identity.publicId+'.webp'));assert.equal(init.headers.Authorization,undefined);
  return new Response(bytes,{headers:{'content-type':'image/webp'}});
 },...patch};return {options,create:()=>createCloudinaryHttpTransport(options),calls,deny:()=>allowed=false};
}
function bridge(f){const transport=f.create();return createCloudinaryMultipartBridge({enabled:true,mode:'isolated-test',now:()=>120000,getCredentials:async()=>credentials,signer:createCloudinarySignedUpload({enabled:true,now:()=>120000,getCredentials:async()=>credentials,authorizeUpload:async()=>true}),sendMultipart:transport.sendMultipart,inspectAsset:transport.inspectAsset});}
test('signed multipart Fetch transport composes with original bridge and independently verifies stored bytes',async()=>{
 const f=fixture(),provider=bridge(f),result=await provider.uploadProcessed(input,ctx());
 assert.deepEqual(result,{assetId:'asset-1'});assert.equal(f.calls.length,4);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
 assert.equal(await provider.verifyUploadResult(result,{publicId:input.publicId,deliveryType:'authenticated',byteSize:bytes.length},ctx()),true);
 assert.ok(!JSON.stringify(result).includes('signature'));assert.ok(!JSON.stringify(result).includes(credentials.apiSecret));
 const raw=f.calls[0].init.body;assert.equal(raw.get('file').type,'image/webp');assert.equal(raw.get('upload_preset'),null);
});
test('default-off and non-test modes call no credential, authorization or network port',async()=>{
 for(const patch of [{enabled:false},{mode:'production'}]){const f=fixture({...patch,getCredentials:async()=>{throw Error('must not read');},authorizeAsset:async()=>{assert.fail('must not authorize');}});await assert.rejects(f.create().inspectAsset(identity,ctx()),/Media transport unconfirmed/);assert.equal(f.calls.length,0);}
});
test('wrong owner, unsafe identity and private/public-type mismatches fail closed',async()=>{
 const denied=fixture();denied.deny();await assert.rejects(denied.create().inspectAsset(identity,ctx()));assert.equal(denied.calls.length,0);
 for(const patch of [{assetId:'../foreign'},{publicId:'https://attacker.invalid'},{version:0}]){const f=fixture();await assert.rejects(f.create().inspectAsset({...identity,...patch},ctx()));assert.equal(f.calls.length,0);}
 for(const patch of [{asset_id:'foreign'},{public_id:'oldx/quarantine/foreignabcdefghijklmnop'},{type:'upload'},{resource_type:'raw'},{format:'svg'},{version:121},{bytes:0},{width:9000}]){const f=fixture({fetchImpl:async()=>json({...metadata,...patch})});await assert.rejects(f.create().inspectAsset(identity,ctx()));}
});
test('independent inspection rejects wrong bytes, MIME and metadata mutation between reads',async()=>{
 for(const scenario of ['bytes','mime','changed']){const f=fixture(),fetch=f.options.fetchImpl;let metadataReads=0;f.options.fetchImpl=async(url,init)=>{
  if(url.includes('/resources/')&&++metadataReads===2&&scenario==='changed')return json({...metadata,version:121});
  if(url.includes('res.cloudinary.com')&&scenario!=='changed')return new Response(scenario==='bytes'?new Uint8Array([1,2,3]):bytes,{headers:{'content-type':scenario==='mime'?'image/svg+xml':'image/webp'}});return fetch(url,init);
 };await assert.rejects(bridge(f).uploadProcessed(input,ctx()));}
 const f=fixture(),fetch=f.options.fetchImpl;f.options.fetchImpl=async(url,init)=>url.includes('res.cloudinary.com')?new Response(Buffer.from('RIFF0000WEBPdifferent'),{headers:{'content-type':'image/webp'}}):fetch(url,init);await assert.rejects(bridge(f).uploadProcessed(input,ctx()));
});
test('upload rejects invalid/expired signature, unsupported or oversized file and foreign destination without dispatch',async()=>{
 const signer=createCloudinarySignedUpload({enabled:true,getCredentials:async()=>credentials,authorizeUpload:async()=>true,now:()=>120000}),signed=await signer.signForServer(input,{actorUid:'owner'});
 for(const patch of [{signature:'0'.repeat(64)},{timestamp:'1'},{type:'upload'},{overwrite:'true'},{public_id:'../private'},{api_key:'00000000'},{file:new Blob([bytes],{type:'image/svg+xml'})},{file:new Blob([new Uint8Array(3*1024*1024+1)],{type:'image/webp'})}]){
  const body=new FormData();for(const [k,v] of Object.entries(signed.grant.fields))body.set(k,String(v));body.set('file',new Blob([bytes],{type:'image/webp'}));for(const [k,v] of Object.entries(patch))body.set(k,v);
  const f=fixture();await assert.rejects(f.create().sendMultipart({url:'https://api.cloudinary.com/v1_1/tfizvbzc/image/upload',method:'POST',body,maxResponseBytes:16384},ctx()));assert.equal(f.calls.length,0);
 }
});
test('redirects, declared/streamed oversized response, invalid JSON and failed/quota responses reject safely',async()=>{
 const variants=[()=>new Response('x'.repeat(16385),{headers:{'content-type':'application/json'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'999999'}}),()=>json({private:'quota details'},429),()=>new Response('{"asset_id":1,"asset_id":2}',{headers:{'content-type':'application/json'}}),()=>({status:200,redirected:true})];
 for(const variant of variants){let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return variant();}});await assert.rejects(bridge(f).uploadProcessed(input,ctx()));assert.equal(calls,1);}
});
test('deadline/abort bounds a transport ignoring cancellation with no automatic retries',async()=>{
 let calls=0;const f=fixture({fetchImpl:async()=>{calls++;return new Promise(()=>{});}});await assert.rejects(f.create().inspectAsset(identity,{...ctx(),deadlineAt:120005}));assert.equal(calls,1);
 const before=ctx();before.signal=AbortSignal.abort();await assert.rejects(f.create().inspectAsset(identity,before));assert.equal(calls,1);
});
test('approved byte gateway revalidates publication after transport and never leaks provider URL',async()=>{
 let published=true;const f=fixture();const provider=f.create(),contract={publicPhotos:async()=>published?{ok:true,parentId:'product-1',parentRevision:2,photoRevision:1,photos:[{imageId:'abcdefghijklmnopqrst',derivativeId:'derivative-1',version:120}]}:{ok:false}};
 const read=async(input,context)=>provider.readApprovedDerivative(input,{...context,deadlineAt:125000});
 const gateway=createApprovedMediaByteDelivery({enabled:true,contract,readApprovedDerivative:read,consumeRateLimit:async()=>({allowed:true})});
 const request={kind:'product',parentId:'product-1',expectedParentRevision:2,expectedPhotoRevision:1,imageId:'abcdefghijklmnopqrst'};
 const result=await gateway.read(request);assert.equal(result.ok,true);assert.deepEqual(result.bytes,bytes);assert.equal(result.headers['Cache-Control'],'no-store');assert.ok(!JSON.stringify(result).includes('cloudinary'));
 const denied=createApprovedMediaByteDelivery({enabled:true,contract,consumeRateLimit:async()=>({allowed:true}),readApprovedDerivative:async(...args)=>{const value=await read(...args);published=false;return value;}});
 assert.equal((await denied.read(request)).ok,false);
});
test('approved lookup rejects wrong digest and revoked mapping; private delivery cannot fall back',async()=>{
 for(const scenario of ['digest','revoked']){const f=fixture();let reads=0;f.options.resolveDerivative=async()=>++reads===2&&scenario==='revoked'?null:{...identity,digest:scenario==='digest'?'0'.repeat(64):hash(bytes)};
 await assert.rejects(f.create().readApprovedDerivative({derivativeId:'approved-1',version:120,maxBytes:3*1024*1024},ctx()));}
 const f=fixture();await assert.rejects(f.create().readApprovedDerivative({derivativeId:'../private',version:120,maxBytes:3*1024*1024},ctx()));assert.equal(f.calls.length,0);
});
test('delete targets immutable managed asset only, requires lease authority and confirms absence',async()=>{
 const request={assetId:identity.assetId,publicId:identity.publicId,resourceType:'image',deliveryType:'authenticated',invalidate:true},f=fixture(),provider=f.create();
 assert.deepEqual(await provider.destroy(request,ctx()),{result:'ok'});assert.equal(f.calls.filter(c=>c.init.method==='DELETE').length,1);assert.ok(f.calls.find(c=>c.init.method==='DELETE').url.includes('asset_ids%5B%5D=asset-1'));
 assert.deepEqual(await provider.destroy(request,ctx()),{result:'not found'});assert.equal(f.calls.filter(c=>c.init.method==='DELETE').length,1);
 const denied=fixture();denied.deny();await assert.rejects(denied.create().destroy(request,ctx()));assert.equal(denied.calls.length,0);
});
test('revoked delete lease and ambiguous delete acknowledgement never release quota or auto-retry',async()=>{
 const request={assetId:identity.assetId,publicId:identity.publicId,resourceType:'image',deliveryType:'authenticated',invalidate:true};
 for(const mode of ['revoked','unknown']){const f=fixture(),fetch=f.options.fetchImpl;let authorizations=0,deleteAttempts=0;f.options.authorizeAsset=async()=>mode!=='revoked'||++authorizations<2;f.options.fetchImpl=async(url,init)=>{if(init.method==='DELETE'){deleteAttempts++;if(mode==='unknown')return json({deleted:{foreign:'deleted'}});}return fetch(url,init);};
 await assert.rejects(f.create().destroy(request,ctx()));assert.equal(deleteAttempts,mode==='unknown'?1:0);}
});
test('approved release version maps to independently verified provider version, never to a guessed CDN version',async()=>{
 const f=fixture({resolveDerivative:async()=>({...identity,digest:hash(bytes),releaseVersion:2})});
 const result=await f.create().readApprovedDerivative({derivativeId:'approved-1',version:2,maxBytes:3*1024*1024},ctx());assert.equal(result.version,2);assert.ok(f.calls.some(c=>c.url.includes('/v120/')));assert.ok(!f.calls.some(c=>c.url.includes('/v2/')));
 await assert.rejects(f.create().readApprovedDerivative({derivativeId:'approved-1',version:3,maxBytes:3*1024*1024},ctx()));
});
