import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStagingAuthenticatedMedia} from '../../scripts/staging-authenticated-media.mjs';
import {createStagingMarketplaceRate} from '../../scripts/staging-marketplace-rate.mjs';
import {createAuthenticatedPhotoClient} from '../../features/media/authenticated-photo-client.mjs';
import {mediaQuotaKeys} from '../../scripts/firebase-media-journal.mjs';
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
export async function exerciseAuthenticatedMedia({binding:b,seed,read,verifyFirebaseToken,ownerToken='owner.test.sig',otherToken='other.test.sig',emulatorTokenSyntax=false}){
 const parentId='authenticated-parent',clock=Date.now()+600000,now=()=>clock;let sends=0,deletes=0,lost=true;
 for(const uid of ['owner','other'])await seed(b.collections.actors,uid,{uid,canWrite:true,suspended:false});
 await seed(b.collections.privateRecords,'product_'+parentId,{id:parentId,kind:'product',ownerUid:'owner',revision:1});
 const quota={known:true,bytesReserved:0,imagesReserved:0,maxBytes:30000000,maxImages:10,reservationsUsed:0,maxReservations:20};
 const quotaKeys=mediaQuotaKeys('owner','product',parentId,null);for(const key of quotaKeys)await seed(b.journalCollections.quotas,key,quota);
 const providerPorts={processor:{decodeAndReencode:async b=>({bytes:b,contentType:'image/webp',width:10,height:10,metadataStripped:true,contentScanned:true})},createUploadProvider:({persistVerifiedUpload})=>({uploadProcessed:async input=>{
  sends++;assert.equal(await persistVerifiedUpload({assetId:'authenticated-asset',publicId:input.publicId,version:120,resourceType:'image',deliveryType:'authenticated',format:'webp',byteSize:input.bytes.length,width:10,height:10,digest:createHash('sha256').update(input.bytes).digest('hex')}),true);if(lost)throw Error('Lost provider ack');return {assetId:'authenticated-asset'};
 }}),destroy:async()=>{deletes++;return {result:'ok'};}};
 const options={enabled:true,binding:b,verifyFirebaseToken,consumeRateLimit:createStagingMarketplaceRate({binding:b,policy:{windowMs:60000,actorLimit:50,globalLimit:100},now}),providerPorts,now,emulatorTokenSyntax};
 const make=patch=>createStagingAuthenticatedMedia({...options,...patch}),intent={requestId:'authenticated-upload',kind:'product',parentId,expectedParentRevision:1,byteSize:bytes.length,contentType:'image/webp',count:1};
 const http=(body,token=ownerToken)=>({method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 assert.equal((await make().upload(http(intent,null),bytes)).status,401);
 assert.equal((await make().upload(http(intent,otherToken),bytes)).status,403);assert.equal(sends,0);
 assert.equal((await make().upload(http({...intent,ownerUid:'other'}),bytes)).status,400);
 assert.equal((await make({consumeRateLimit:null}).upload(http(intent),bytes)).status,503);
 assert.equal((await make({consumeRateLimit:async()=>({allowed:false})}).upload(http(intent),bytes)).status,429);
 assert.equal((await make().upload(http({...intent,byteSize:bytes.length+1}),bytes)).status,400);
 assert.equal((await make().upload(http({...intent,expectedParentRevision:2}),bytes)).status,409);
 const unknown=await make().upload(http(intent),bytes);assert.equal(unknown.status,202);assert.equal(unknown.body.retrySameRequest,true);assert.equal(sends,1);
 const statusRequest={requestId:intent.requestId,kind:'product',parentId};
 const status=await make().command('status',http(statusRequest));assert.equal(status.status,200);assert.equal(status.body.state,'uploading');assert.ok(!JSON.stringify(status.body).includes('digest'));assert.ok(!JSON.stringify(status.body).includes('assetId'));
 assert.equal((await make().command('status',http(statusRequest,otherToken))).status,403);
 assert.equal((await make().command('status',http({...statusRequest,parentId:'foreign'}))).status,403);
 lost=false;
 const photoClient=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>({uid:s.uid,sessionId:s.sessionId,token:ownerToken}),sendUpload:(body,file,auth)=>make().upload(http(body,auth.credential),file,{signal:auth.signal}),sendCommand:(op,body,auth)=>make().command(op,http(body,auth.credential),{signal:auth.signal})});
 photoClient.setScope({uid:'owner',sessionId:'native-session',parentId,revision:1});
 const recoveredClient=await photoClient.upload({requestId:intent.requestId,kind:'product',parentId,expectedParentRevision:1,contentType:'image/webp',bytes});assert.equal(recoveredClient.ok,true);assert.equal(sends,1);
 assert.equal((await photoClient.recover({requestId:intent.requestId,kind:'product',parentId,expectedParentRevision:1})).ok,true);
 const complete=await make().upload(http(intent),bytes);assert.equal(complete.status,200);assert.equal(complete.body.state,'quarantined');assert.equal(sends,1);
 assert.ok(!JSON.stringify(complete).includes('ownerUid'));assert.ok(!JSON.stringify(complete).includes('nonce'));
 assert.equal((await make().upload(http(intent),bytes)).body.replayed,true);assert.equal(sends,1);
 const altered=new Uint8Array(bytes);altered[altered.length-1]++;
 assert.equal((await make().upload(http(intent),altered)).status,409);assert.equal(sends,1);
 const removal={requestId:'authenticated-delete',imageId:complete.body.imageId,expectedRevision:complete.body.revision};
 assert.notEqual((await make().command('remove',http(removal,otherToken))).status,200);assert.equal(deletes,0);
 const deleted=await make().command('remove',http(removal));assert.equal(deleted.status,200);assert.equal(deleted.body.state,'deleted');assert.equal(deletes,1);
 assert.equal((await make().command('remove',http(removal))).body.replayed,true);assert.equal(deletes,1);
 for(const key of quotaKeys)assert.equal((await read(b.journalCollections.quotas,key)).imagesReserved,0);
 // Once dispatch has been claimed, cancellation/deadline preserve the lease.
 for(const reason of ['abort','deadline']){
  let start,release,attempts=0;const started=new Promise(r=>start=r),gate=new Promise(r=>release=r),controller=new AbortController();
  const pendingPorts={...providerPorts,createUploadProvider:()=>({uploadProcessed:async()=>{attempts++;start();await gate;throw Error('late unconfirmed provider');}})};
  const port=make({providerPorts:pendingPorts,...(reason==='deadline'?{timeoutMs:1000}:{})}),r={...intent,requestId:reason+'-upload'};
  const pending=port.upload(http(r),bytes,{signal:controller.signal});
  await Promise.race([started,pending.then(value=>{throw Error('Provider did not start: '+value.status);})]);if(reason==='abort')controller.abort();
  const stopped=await pending;assert.equal(stopped.status,202);assert.equal(stopped.body.retrySameRequest,true);release();
  assert.equal((await make({providerPorts:pendingPorts}).upload(http(r),bytes)).status,202);assert.equal(attempts,1);
 }
 assert.equal((await read(b.journalCollections.quotas,quotaKeys[0])).imagesReserved,2);
 await seed(b.journalCollections.quotas,quotaKeys[0],{...quota,maxBytes:1});
 const denied=await make().upload(http({...intent,requestId:'quota-denied'}),bytes);assert.equal(denied.status,503);assert.equal(sends,1);
 const unavailable=await make({verifyFirebaseToken:async()=>{throw Error('revoked private token detail');}}).upload(http(intent),bytes);assert.equal(unavailable.status,401);assert.ok(!JSON.stringify(unavailable).includes('private token detail'));
 return complete.body.imageId;
}
