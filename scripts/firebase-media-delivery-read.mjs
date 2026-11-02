import {createHash} from 'node:crypto';
import {isolatedFirestoreContext,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
// Bounded atomic snapshot for the separate public projection contract; no provider
// URLs, tokens, network construction, private Chat query or public activation.
export function createIsolatedPublicMediaRead({enabled=false,firestore,sdk,schema,parentCollections,publicCollections,actorCollections,now=Date.now}={}){
 if(enabled!==true)return async()=>null;
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles:['assets','associations','receipts','audits']});
 for(const mapping of [parentCollections,publicCollections,actorCollections])if(!copyRecord(mapping,['product','store'])||Object.values(mapping).some(v=>typeof v!=='string'||!/^testOldx[A-Za-z0-9]{1,48}$/.test(v)))throw new Error('Unactivated public media mapping');
 return async(request,context)=>sdk.runTransaction(db,async raw=>{
  const check=()=>isolatedTransactionCheck(context.signal,context.deadlineAt,now),read=async ref=>{check();const snapshot=await raw.get(ref);check();if(!snapshot.exists())return null;const {committedAt,...facts}=snapshot.data();return facts;};check();
  if(!['product','store'].includes(request.kind)||typeof request.parentId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(request.parentId))return null;
  const key=request.kind+'_'+request.parentId,parent=await read(sdk.doc(db,parentCollections[request.kind],key)),view=await read(sdk.doc(db,publicCollections[request.kind],key));if(!parent||parent.id!==request.parentId||parent.kind!==request.kind||typeof parent.ownerUid!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(parent.ownerUid)||parent.published!==true||parent.publicationRevision!==request.expectedParentRevision||JSON.stringify(parent.publicProfile)!==JSON.stringify(view))return null;
  const actor=await read(sdk.doc(db,actorCollections[request.kind],parent.ownerUid));if(actor?.uid!==parent.ownerUid||actor.canWrite!==true||actor.suspended!==false)return null;
  if(request.kind==='product'&&view.storeId!==null){const store=await read(sdk.doc(db,parentCollections.store,'store_'+view.storeId));if(!store||store.ownerUid!==parent.ownerUid||store.published!==true)return null;}
  const associationId=createHash('sha256').update(JSON.stringify([request.kind,request.parentId,null])).digest('hex'),association=await read(sdk.doc(db,c.associations,associationId));if(!association||!Array.isArray(association.imageIds)||association.imageIds.length>6)return null;const assets=[];for(const imageId of association.imageIds){if(typeof imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(imageId))return null;assets.push(await read(sdk.doc(db,c.assets,imageId)));}check();return {parent:{kind:parent.kind,id:parent.id,ownerUid:parent.ownerUid,publicationRevision:parent.publicationRevision,published:true,actorActive:true},association:{...association,associationId},assets};
 },{maxAttempts:3});
}
