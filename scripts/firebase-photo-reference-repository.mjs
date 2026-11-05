import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {isolatedFirestoreContext,safeId,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
const roles=['assets','associations','receipts','audits'];
export const PHOTO_REFERENCE_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxPhoto'+k[0].toUpperCase()+k.slice(1)])));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=code=>({ok:false,code}),int=v=>Number.isSafeInteger(v)&&v>=0;
// Durable private reference transactions only. Upload bytes/credentials/provider
// deletion, public media release and legacy migration remain unimplemented/off.
function referenceCore({sdk,parentCollections,actorCollections,providerCollections,authenticate,now=Date.now,timeoutMs=5000}={}, {db,collections:c},nativeScope=false){
 if(!copyRecord(parentCollections,['product','store','provider'])||Object.values(parentCollections).some(v=>typeof v!=='string'||(!nativeScope&&!/^test(?:Oldx|Provider)[A-Za-z0-9]{1,48}$/.test(v))))throw new Error('Unactivated parent schema');const parents={...parentCollections};if(!copyRecord(actorCollections,['product','store','provider'])||Object.values(actorCollections).some(v=>typeof v!=='string'||(!nativeScope&&!/^test(?:Oldx|Provider)[A-Za-z0-9]{1,48}$/.test(v))))throw new Error('Unactivated actor schema');const actors={...actorCollections};
 const ref=(role,id)=>sdk.doc(db,c[role],id);
 async function read(raw,r){const snap=await raw.get(r);if(!snap.exists())return null;const {committedAt,...data}=snap.data();return data;}
 return Object.freeze({async apply(request,{credential,signal}={}){
  const input=copyRecord(request,['requestId','kind','parentId','expectedParentRevision','expectedPhotoRevision','imageIds','service']);
  if(!input||!safeId(input.requestId)||!(nativeScope==='provider'?['provider']:nativeScope?['product','store']:['product','store','provider']).includes(input.kind)||!safeId(input.parentId)||!int(input.expectedParentRevision)||!int(input.expectedPhotoRevision)||!Array.isArray(input.imageIds)||input.imageIds.length>(input.kind==='store'||nativeScope==='provider'&&input.service===null?1:6)||input.imageIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(id))||new Set(input.imageIds).size!==input.imageIds.length||input.service!==null&&(input.kind!=='provider'||typeof input.service!=='string'||input.service.length<1||input.service.length>80))return fail('INVALID_REQUEST');
  const snapshot=structuredClone(input);return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,run:async context=>{
   const uid=context.actorUid,key=hash([uid,snapshot.requestId]),associationId=hash([snapshot.kind,snapshot.parentId,snapshot.service]),fingerprint=hash(snapshot);context.markMutationAttempted();
   return sdk.runTransaction(db,async raw=>{
    const check=()=>isolatedTransactionCheck(context.signal,context.deadlineAt,now);check();const actor=await read(raw,sdk.doc(db,actors[snapshot.kind],uid));if(actor?.uid!==uid||actor.canWrite!==true||actor.suspended!==false)return fail('DENIED');const parentKey=snapshot.kind==='provider'?snapshot.parentId:snapshot.kind+'_'+snapshot.parentId,parentRef=sdk.doc(db,parents[snapshot.kind],parentKey),parent=await read(raw,parentRef),association=await read(raw,ref('associations',associationId)),receipt=await read(raw,ref('receipts',key)),audit=await read(raw,ref('audits',key));
    if(!parent||parent.ownerUid!==uid||(snapshot.kind==='provider'?parent.providerId:parent.id)!==snapshot.parentId||!int(parent.revision)||snapshot.kind!=='provider'&&parent.kind!==snapshot.kind||snapshot.service!==null&&!parent.profile?.services?.includes(snapshot.service)&&!(nativeScope==='provider'&&snapshot.imageIds.length===0))return fail('DENIED');
    let album=null,albumKey=null,nextGroups=null;
    if(nativeScope==='provider'){
     const identity=await read(raw,sdk.doc(db,providerCollections.identities,snapshot.parentId)),mapping=await read(raw,sdk.doc(db,providerCollections.owners,uid));
     if(identity?.providerId!==snapshot.parentId||identity.ownerUid!==uid||mapping?.providerId!==snapshot.parentId||mapping.ownerUid!==uid||mapping.revision!==parent.revision||!['draft','published'].includes(mapping.status))return fail('DENIED');
     albumKey='provider_album_'+hash(snapshot.parentId);album=await read(raw,ref('associations',albumKey));
     if(album&&(!copyRecord(album,['schemaVersion','providerId','ownerUid','revision','groups'])||album.schemaVersion!==1||album.providerId!==snapshot.parentId||album.ownerUid!==uid||!int(album.revision)||!Array.isArray(album.groups)||album.groups.length>7||album.groups.some(g=>!copyRecord(g,['service','imageIds'])||g.service!==null&&(typeof g.service!=='string'||g.service.length<1||g.service.length>80)||!Array.isArray(g.imageIds)||g.imageIds.length>(g.service===null?1:6)||g.imageIds.some(v=>typeof v!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(v)))||new Set(album.groups.map(g=>g.service)).size!==album.groups.length))return fail('CONFLICT');
     if(snapshot.service!==null&&!parent.profile?.services?.includes(snapshot.service)&&!association)return fail('DENIED');
     if(association?.imageIds?.length&&!album)return fail('CONFLICT');
     const existing=(album?.groups??[]).flatMap(g=>g.imageIds);if(new Set(existing).size!==existing.length||(album?.groups??[]).filter(g=>g.service!==null).reduce((sum,g)=>sum+g.imageIds.length,0)>6||album&&album.revision===Number.MAX_SAFE_INTEGER)return fail('CONFLICT');
    }
    if(association&&(!copyRecord(association,['kind','parentId','service','ownerUid','parentRevision','photoRevision','imageIds','visibility'])||association.kind!==snapshot.kind||association.parentId!==snapshot.parentId||association.service!==snapshot.service||association.ownerUid!==uid||!int(association.parentRevision)||!int(association.photoRevision)||association.visibility!=='private'||!Array.isArray(association.imageIds)||association.imageIds.length>6||association.imageIds.some(v=>typeof v!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(v))))return fail('CONFLICT');
    if(receipt){if(receipt.actorUid!==uid||receipt.fingerprint!==fingerprint||receipt.associationId!==associationId||audit?.requestKey!==key||audit.actorUid!==uid||audit.photoRevision!==receipt.photoRevision||!association||association.ownerUid!==uid||association.photoRevision<receipt.photoRevision)return fail('IDEMPOTENCY_CONFLICT');return {ok:true,status:'replayed',photoRevision:receipt.photoRevision};}
    if(nativeScope==='provider'){
     const group=(album?.groups??[]).find(g=>g.service===snapshot.service);if(JSON.stringify(group?.imageIds??[])!==JSON.stringify(association?.imageIds??[]))return fail('CONFLICT');
     nextGroups=(album?.groups??[]).filter(g=>g.service!==snapshot.service);if(snapshot.imageIds.length)nextGroups.push({service:snapshot.service,imageIds:[...snapshot.imageIds]});const all=nextGroups.flatMap(g=>g.imageIds);if(nextGroups.filter(g=>g.service!==null).reduce((sum,g)=>sum+g.imageIds.length,0)>6||new Set(all).size!==all.length)return fail('LIMIT_REACHED');
    }
    if(parent.revision!==snapshot.expectedParentRevision||(association?.photoRevision??0)!==snapshot.expectedPhotoRevision||association&&association.ownerUid!==uid)return fail('REVISION_CONFLICT');
    const ids=new Set([...(association?.imageIds??[]),...snapshot.imageIds]);if(ids.size>12)return fail('CONFLICT');const assets=new Map();
    for(const imageId of ids){const asset=await read(raw,ref('assets',imageId));if(!asset||asset.imageId!==imageId||asset.ownerUid!==uid||asset.parentId!==snapshot.parentId||asset.kind!==snapshot.kind||asset.service!==snapshot.service||!['quarantined','attached'].includes(asset.state)||!Array.isArray(asset.references)||asset.references.length>12||asset.references.some(v=>!safeId(v))||(!int(asset.revision)||asset.revision===Number.MAX_SAFE_INTEGER))return fail('DENIED');if(snapshot.imageIds.includes(imageId)&&Object.hasOwn(asset,'parentRevision')&&asset.parentRevision!==parent.revision&&!(nativeScope==='provider'&&asset.parentRevision<parent.revision&&association?.parentRevision===asset.parentRevision&&asset.references.includes(associationId)))return fail('REVISION_CONFLICT');assets.set(imageId,asset);}
    const photoRevision=snapshot.expectedPhotoRevision+1;if(!Number.isSafeInteger(photoRevision))return fail('CONFLICT');check();
    if(nativeScope==='provider')raw.set(ref('associations',albumKey),{schemaVersion:1,providerId:snapshot.parentId,ownerUid:uid,revision:(album?.revision??0)+1,groups:nextGroups,committedAt:sdk.serverTimestamp()});
    for(const [imageId,asset] of assets){const references=asset.references.filter(v=>v!==associationId);if(snapshot.imageIds.includes(imageId))references.push(associationId);if(references.length>12)throw new Error('Reference limit');raw.set(ref('assets',imageId),{...asset,...(nativeScope==='provider'&&snapshot.imageIds.includes(imageId)?{parentRevision:parent.revision}:{}),state:references.length?'attached':'quarantined',references,revision:asset.revision+1,committedAt:sdk.serverTimestamp()});}
    raw.set(ref('associations',associationId),{kind:snapshot.kind,parentId:snapshot.parentId,service:snapshot.service,ownerUid:uid,parentRevision:parent.revision,photoRevision,imageIds:[...snapshot.imageIds],visibility:'private',committedAt:sdk.serverTimestamp()});raw.set(ref('receipts',key),{actorUid:uid,fingerprint,associationId,photoRevision});raw.set(ref('audits',key),{requestKey:key,actorUid:uid,associationId,photoRevision,parentRevision:parent.revision,operation:'replace-private-photo-references'});check();return {ok:true,status:'saved',photoRevision};
   },{maxAttempts:3});
  }});
 }});
}

export function createIsolatedPhotoReferenceRepository(options={}){
 if(options.enabled!==true)return Object.freeze({apply:async()=>fail('UNAVAILABLE')});return referenceCore(options,isolatedFirestoreContext({...options,roles}));
}
export function createStagingPhotoReferenceRepository(options={}){
 if(options.enabled!==true)return Object.freeze({apply:async()=>fail('UNAVAILABLE')});const b=requireStagingMarketplaceBinding(options.binding);
 return referenceCore({...options,sdk:b.sdk,parentCollections:{product:b.collections.privateRecords,store:b.collections.privateRecords,provider:'unsupportedProvider'},actorCollections:{product:b.collections.actors,store:b.collections.actors,provider:'unsupportedProvider'}},{db:b.db,collections:b.referenceCollections},true);
}

// Reuse the reference transaction implementation inside the parent transaction.
// All reads finish before commit(); no nested SDK transaction/provider work.
export function createStagingDraftPhotoReferences({enabled=false,binding,now=Date.now}={}){
 if(enabled!==true)return null;const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.referenceCollections;
 const marker=key=>'draft_parent_'+key,read=async(raw,role,key)=>{const s=await raw.get(sdk.doc(db,c[role],key));return s.exists()?s.data():null;};
 return Object.freeze({marketplaceCollections:b.collections,
  async verifyReplay(raw,claims){
   const key=marker(claims.requestKey),r=await read(raw,'receipts',key),a=await read(raw,'audits',key);
   return !!r&&!!a&&['actorUid','requestKey','fingerprint','kind','parentId','parentRevision'].every(k=>r[k]===claims[k]&&a[k]===claims[k]);
  },
  async prepare(raw,{kind,previous,next,actorUid,requestKey,fingerprint,signal}){
   const photos=next.profile?.photos;
   if(!['product','store'].includes(kind)||next.ownerUid!==actorUid||!Array.isArray(photos)||photos.some(p=>typeof p!=='string'&&(!p||p.kind!=='managed')))return fail('DENIED');
   const key=marker(requestKey),existing=await read(raw,'receipts',key),audit=await read(raw,'audits',key);if(existing||audit)return fail('CONFLICT');
   const associationId=hash([kind,next.id,null]),association=await read(raw,'associations',associationId),writes=[];
   // Preserve legacy strings; never migrate or publicly release them here.
   if(photos.some(p=>typeof p==='string')){if(association)return fail('CONFLICT');}
   else if(previous&&(association||photos.length)){
    const staged={get:r=>raw.get(r),set(r,value){
     let row=value;
     if(r.path.startsWith(c.assets+'/')||r.path.startsWith(c.associations+'/')||r.path.startsWith(c.audits+'/'))row={...value,parentRevision:next.revision};
     writes.push(()=>raw.set(r,row));
    }};
    const shim={...sdk,runTransaction:async(_db,work)=>work(staged)};
    const references=referenceCore({sdk:shim,authenticate:async()=>({uid:actorUid}),now,parentCollections:{product:b.collections.privateRecords,store:b.collections.privateRecords,provider:'unsupportedProvider'},actorCollections:{product:b.collections.actors,store:b.collections.actors,provider:'unsupportedProvider'}},{db,collections:c},true);
    const result=await references.apply({requestId:'draft_'+requestKey,kind,parentId:next.id,service:null,expectedParentRevision:previous.revision,expectedPhotoRevision:association?.photoRevision??0,imageIds:photos.map(p=>p.imageId)},{signal});
    if(result?.ok!==true)return result;
   }else if(photos.length)return fail('DENIED');
   const receipt={kind,parentId:next.id,actorUid,requestKey,fingerprint,parentRevision:next.revision};
   return {ok:true,commit(){for(const write of writes)write();raw.set(sdk.doc(db,c.receipts,key),receipt);raw.set(sdk.doc(db,c.audits,key),receipt);}};
  }
 });
}

export function createStagingOwnerPhotoRead({enabled=false,binding,authenticate,now=Date.now}={}){
 if(enabled!==true)return async()=>fail('UNAVAILABLE');const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.referenceCollections;
 return async(input,{credential,signal}={})=>{
  const r=copyRecord(input,['kind','parentId','expectedParentRevision']);if(!r||!['product','store'].includes(r.kind)||!safeId(r.parentId)||!int(r.expectedParentRevision)||r.expectedParentRevision<1)return fail('INVALID_REQUEST');
  return runVerifiedOperation({authenticate,credential,signal,now,run:context=>sdk.runTransaction(db,async tx=>{
   const get=async(collection,id)=>{context.checkpoint();const s=await tx.get(sdk.doc(db,collection,id));return s.exists()?s.data():null;};
   const parent=await get(b.collections.privateRecords,r.kind+'_'+r.parentId),actor=await get(b.collections.actors,context.actorUid),associationId=hash([r.kind,r.parentId,null]),a=await get(c.associations,associationId);
   if(parent?.id!==r.parentId||parent.kind!==r.kind||parent.ownerUid!==context.actorUid||parent.archived===true||actor?.uid!==context.actorUid||actor.canWrite!==true||actor.suspended!==false)return fail('DENIED');
   if(parent.revision!==r.expectedParentRevision)return fail('REVISION_CONFLICT');
   if(!a)return {ok:true,parentId:r.parentId,parentRevision:parent.revision,photoRevision:0,photos:[]};
   if(a.ownerUid!==context.actorUid||a.kind!==r.kind||a.parentId!==r.parentId||a.parentRevision!==parent.revision||a.service!==null||a.visibility!=='private'||!int(a.photoRevision)||!Array.isArray(a.imageIds)||a.imageIds.length>(r.kind==='store'?1:6)||new Set(a.imageIds).size!==a.imageIds.length)return fail('CONFLICT');
   for(const imageId of a.imageIds){if(typeof imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(imageId))return fail('CONFLICT');const asset=await get(c.assets,imageId);if(asset?.imageId!==imageId||asset.ownerUid!==context.actorUid||asset.parentId!==r.parentId||asset.kind!==r.kind||asset.parentRevision!==parent.revision||asset.state!=='attached'||!asset.references?.includes(associationId))return fail('DENIED');}
   context.checkpoint();return {ok:true,parentId:r.parentId,parentRevision:parent.revision,photoRevision:a.photoRevision,photos:a.imageIds.map(imageId=>({kind:'managed',imageId}))};
  },{maxAttempts:3})});
 };
}

export function createStagingProviderPhotoReferenceRepository(options={}){
 if(options.enabled!==true)return Object.freeze({apply:async()=>fail('UNAVAILABLE')});const b=requireStagingMarketplaceBinding(options.binding);
 return referenceCore({...options,sdk:b.sdk,providerCollections:b.providerCollections,parentCollections:{product:'unsupportedProduct',store:'unsupportedStore',provider:b.providerCollections.drafts},actorCollections:{product:'unsupportedProduct',store:'unsupportedStore',provider:b.providerCollections.actors}},{db:b.db,collections:b.referenceCollections},'provider');
}

export function createStagingProviderOwnerPhotoRead({enabled=false,binding,authenticate,now=Date.now}={}){
 if(enabled!==true)return async()=>fail('UNAVAILABLE');const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.providerCollections;
 return async(request,{credential,signal}={})=>{const r=copyRecord(request,['kind','parentId','expectedParentRevision','service']);if(!r||r.kind!=='provider'||!safeId(r.parentId)||!int(r.expectedParentRevision)||r.expectedParentRevision<1||r.service!==null&&(typeof r.service!=='string'||r.service.length>80))return fail('INVALID_REQUEST');
  return runVerifiedOperation({authenticate,credential,signal,now,run:context=>sdk.runTransaction(db,async tx=>{const get=async(collection,key)=>{context.checkpoint();const s=await tx.get(sdk.doc(db,collection,key));return s.exists()?s.data():null;},uid=context.actorUid;
   const parent=await get(c.drafts,r.parentId),actor=await get(c.actors,uid),identity=await get(c.identities,r.parentId),owner=await get(c.owners,uid);
   if(parent?.providerId!==r.parentId||parent.ownerUid!==uid||actor?.uid!==uid||actor.canWrite!==true||actor.suspended!==false||identity?.providerId!==r.parentId||identity.ownerUid!==uid||owner?.providerId!==r.parentId||owner.ownerUid!==uid||owner.revision!==parent.revision||!['draft','published'].includes(owner.status))return fail('DENIED');if(parent.revision!==r.expectedParentRevision)return fail('REVISION_CONFLICT');
   const scope=hash(['provider',r.parentId,r.service]),a=await get(b.referenceCollections.associations,scope);if(!a)return {ok:true,parentId:r.parentId,parentRevision:parent.revision,photoRevision:0,photos:[]};
   if(a.kind!=='provider'||a.parentId!==r.parentId||a.ownerUid!==uid||a.service!==r.service||a.visibility!=='private'||!int(a.photoRevision)||!Array.isArray(a.imageIds)||a.imageIds.length>(r.service===null?1:6)||new Set(a.imageIds).size!==a.imageIds.length)return fail('CONFLICT');
   for(const imageId of a.imageIds){if(typeof imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(imageId))return fail('CONFLICT');const asset=await get(b.referenceCollections.assets,imageId);if(asset?.imageId!==imageId||asset.ownerUid!==uid||asset.kind!=='provider'||asset.parentId!==r.parentId||asset.service!==r.service||asset.state!=='attached'||!asset.references?.includes(scope))return fail('DENIED');}
   context.checkpoint();return {ok:true,parentId:r.parentId,parentRevision:parent.revision,photoRevision:a.photoRevision,photos:a.imageIds.map(imageId=>({kind:'managed',imageId}))};
  },{maxAttempts:3})});
 };
}
