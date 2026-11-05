import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createStagingMediaProviderRuntime} from '../../scripts/staging-media-provider-runtime.mjs';
import {mediaQuotaKeys} from '../../scripts/firebase-media-journal.mjs';
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const digest=createHash('sha256').update(bytes).digest('hex');
export async function exerciseNativeMediaProofs({binding:b,seed,read,loseJournalAck}){
 let actor='owner',sends=0,deletes=0,lost=true,inspection=null,deleteUnknown=false;
 const parentId='proof-parent',j=b.journalCollections,c=b.collections;
 await seed(c.actors,'owner',{uid:'owner',canWrite:true,suspended:false});await seed(c.actors,'other',{uid:'other',canWrite:true,suspended:false});
 await seed(c.privateRecords,'product_'+parentId,{id:parentId,kind:'product',ownerUid:'owner',revision:1});
 const quota={known:true,bytesReserved:0,imagesReserved:0,maxBytes:30000000,maxImages:10,reservationsUsed:0,maxReservations:20};
 for(const key of mediaQuotaKeys('owner','product',parentId,null))await seed(j.quotas,key,quota);
 const options={enabled:true,binding:b,authenticate:async()=>({uid:actor}),processor:{decodeAndReencode:async source=>({bytes:source,contentType:'image/webp',width:10,height:10,metadataStripped:true,contentScanned:true})},createUploadProvider:({persistVerifiedUpload})=>({uploadProcessed:async input=>{
  sends++;inspection={assetId:'provider-asset-'+sends,publicId:input.publicId,version:120,resourceType:'image',deliveryType:'authenticated',format:'webp',byteSize:bytes.length,width:10,height:10,digest};
  assert.equal(await persistVerifiedUpload(inspection),true);if(lost)throw Error('Lost ack after durable verification');return {assetId:inspection.assetId};
 }}),inspectAsset:async()=>inspection,destroy:async()=>{deletes++;if(deleteUnknown)throw Error('Unknown delete');return {result:'ok'};}};
 const make=patch=>createStagingMediaProviderRuntime({...options,...patch}),runtime=make();
 const reservation=await runtime.journal.reserve({requestId:'proof-reserve',kind:'product',parentId,service:null,expectedParentRevision:1,sourceDigest:digest,reservedBytes:1024});assert.equal(reservation.ok,true);
 const imageId=reservation.imageId;
 assert.equal((await runtime.journal.transition('attempt',{requestId:'proof-attempt',imageId,expectedRevision:0,proof:null})).ok,true);
 const request={requestId:'proof-confirm',imageId,expectedRevision:1};
 assert.equal((await runtime.upload(request,bytes)).code,'OUTCOME_UNKNOWN');assert.equal(sends,1);
 const restarted=make();lost=false;
 if(loseJournalAck){loseJournalAck();assert.equal((await restarted.upload(request,bytes)).code,'OUTCOME_UNKNOWN');assert.equal(sends,1);}
 const recovered=await restarted.upload(request,bytes);assert.equal(recovered.ok,true,JSON.stringify(recovered));assert.equal(recovered.state,'quarantined');assert.equal(sends,1);
 assert.equal((await restarted.upload(request,bytes)).replayed,true);assert.equal(sends,1);
 actor='other';assert.equal((await restarted.upload(request,bytes,{authenticate:()=>({uid:'owner'})})).ok,false);actor='owner';
 const asset=await read(j.assets,imageId);assert.equal(asset.processedDigest,digest);assert.equal(asset.state,'quarantined');
 assert.equal((await restarted.journal.transition('lease-delete',{requestId:'proof-delete-lease',imageId,expectedRevision:2,proof:null})).ok,true);
 const removal={requestId:'proof-delete',imageId,expectedRevision:3};assert.equal((await restarted.remove(removal)).ok,true);assert.equal(deletes,1);
 assert.equal((await make().remove(removal)).replayed,true);assert.equal(deletes,1);
 for(const key of mediaQuotaKeys('owner','product',parentId,null)){const q=await read(j.quotas,key);assert.equal(q.bytesReserved,0);assert.equal(q.imagesReserved,0);}
 // An in-flight upload without a durable proof cannot be dispatched a second time.
 const reserved2=await runtime.journal.reserve({requestId:'proof-reserve-2',kind:'product',parentId,service:null,expectedParentRevision:1,sourceDigest:digest,reservedBytes:1024});
 assert.equal((await runtime.journal.transition('attempt',{requestId:'proof-attempt-2',imageId:reserved2.imageId,expectedRevision:0,proof:null})).ok,true);
 const req2={requestId:'proof-confirm-2',imageId:reserved2.imageId,expectedRevision:1};let uncertainSends=0;
 const uncertain=make({createUploadProvider:()=>({uploadProcessed:async()=>{uncertainSends++;throw Error('Lost provider response');}})});
 assert.equal((await uncertain.upload(req2,bytes)).code,'OUTCOME_UNKNOWN');assert.equal((await uncertain.upload(req2,bytes)).code,'OUTCOME_UNKNOWN');assert.equal(uncertainSends,1);
 inspection={...inspection,publicId:'oldx/quarantine/'+reserved2.imageId,assetId:'reconciled-asset'};
 assert.equal((await make({inspectAsset:async()=>({...inspection,digest:'0'.repeat(64)})}).reconcileUpload(req2,{assetId:'reconciled-asset',version:120})).code,'OUTCOME_UNKNOWN');
 const reconciled=await make().reconcileUpload(req2,{assetId:'reconciled-asset',version:120});assert.equal(reconciled.ok,true);assert.equal(reconciled.state,'quarantined');assert.equal(uncertainSends,1);
 assert.equal((await runtime.journal.transition('lease-delete',{requestId:'unknown-lease',imageId:reserved2.imageId,expectedRevision:2,proof:null})).ok,true);
 deleteUnknown=true;const reqDelete={requestId:'unknown-delete',imageId:reserved2.imageId,expectedRevision:3};assert.equal((await make().remove(reqDelete)).code,'OUTCOME_UNKNOWN');
 const deletionCount=deletes;assert.equal((await make().remove(reqDelete)).code,'OUTCOME_UNKNOWN');assert.equal(deletes,deletionCount);
 assert.equal((await make().reconcileDelete(reqDelete)).code,'OUTCOME_UNKNOWN');
 const notSettled=make({inspectDeletionSettlement:async expected=>({...expected,status:'absent',definitive:true,operationSettled:false})});assert.equal((await notSettled.reconcileDelete(reqDelete)).code,'OUTCOME_UNKNOWN');
 assert.equal((await read(j.assets,reserved2.imageId)).state,'deleting');
 const settled=make({inspectDeletionSettlement:async expected=>({...expected,status:'absent',definitive:true,operationSettled:true})});assert.equal((await settled.reconcileDelete(reqDelete)).ok,true);
 for(const key of mediaQuotaKeys('owner','product',parentId,null))assert.equal((await read(j.quotas,key)).imagesReserved,0);
 // Parent changes before dispatch fail closed and quota is not silently refunded.
 const r3=await runtime.journal.reserve({requestId:'stale-reserve',kind:'product',parentId,service:null,expectedParentRevision:1,sourceDigest:digest,reservedBytes:1024});
 await runtime.journal.transition('attempt',{requestId:'stale-attempt',imageId:r3.imageId,expectedRevision:0,proof:null});
 await seed(c.privateRecords,'product_'+parentId,{id:parentId,kind:'product',ownerUid:'owner',revision:2});
 const beforeSends=sends;assert.equal((await make().upload({requestId:'stale-upload',imageId:r3.imageId,expectedRevision:1},bytes)).ok,false);assert.equal(sends,beforeSends);
 const qkey=mediaQuotaKeys('owner','product',parentId,null)[0];assert.equal((await read(j.quotas,qkey)).imagesReserved,1);
 return {sends,deletes};
}
