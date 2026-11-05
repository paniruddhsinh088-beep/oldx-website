import {requireProviderMediaRelease} from './provider-media-release.mjs';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createHash} from 'node:crypto';
import {DISCOVERY_FIELDS} from '../features/service-providers/provider-discovery.mjs';
const names=['actors','owners','identities','drafts','receipts','audits','permissions','publications','publicViews','generations'];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const digest=values=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
// Actual modular Firebase transaction API, injection only. No SDK initialization,
// environment credentials, network construction or production-enable mode.
function providerRepository({sdk,photoPolicy,mediaRelease,publicationAllowed=true,now=Date.now}={}, {db,collections}){
 const unavailable=()=>{throw new Error('Provider repository unavailable');};
 const ref=(name,key)=>{if(!id(key)&&!/^[a-f0-9]{64}$/.test(key))unavailable();return sdk.doc(db,collections[name],key);};
 const receiptRef=(uid,operation,key)=>ref('receipts',digest([uid,operation,key]));
 return Object.freeze({async runTransaction(callback,{signal,deadlineAt}={}){
  const check=()=>{if(signal?.aborted||!Number.isSafeInteger(deadlineAt)||now()>=deadlineAt)throw new Error('Provider transaction stopped');};check();
  return sdk.runTransaction(db,async raw=>{
   check();let mutation=null,kind=null;const cache=new Map();
   async function get(reference){check();if(!cache.has(reference.path)){const snapshot=await raw.get(reference);check();const data=snapshot.exists()?snapshot.data():null;if(data){const {committedAt,...facts}=data;cache.set(reference.path,facts);}else cache.set(reference.path,null);}return cache.get(reference.path);}
   const fields=async(reference,keys)=>{const data=await get(reference);return data===null?null:Object.fromEntries(keys.map(k=>[k,data[k]]));};
   const tx={
    checkPublicationPhotos:claims=>typeof photoPolicy?.check==='function'?photoPolicy.check(raw,claims):Promise.resolve(false),
    getActorState:uid=>fields(ref('actors',uid),['uid','canWrite','suspended']),
    getOwnedProvider:uid=>fields(ref('owners',uid),['providerId','ownerUid','revision','status']),
    getProviderIdentity:providerId=>fields(ref('identities',providerId),['providerId','ownerUid']),
    getDraftMetadata:providerId=>fields(ref('drafts',providerId),['providerId','ownerUid','revision']),
    getDraft:providerId=>get(ref('drafts',providerId)),
    getIdempotency:async(uid,operation,key)=>{const r=await get(receiptRef(uid,operation,key));if(r&&mediaRelease&&operation==='provider-publication'&&!await mediaRelease.verifyReplay(raw,r))throw Error('Provider media replay conflict');return r;},
    getAudit:key=>get(ref('audits',key)),
    getPublicationPermission:uid=>fields(ref('permissions',uid),['uid','canPublish','canWithdraw','suspended']),
    getGeneration:()=>fields(ref('generations','current'),['value']),
    getPublication:providerId=>get(ref('publications',providerId)),
    stagePrivateDraft:value=>{if(mutation)throw new Error('Duplicate staging');kind='draft';mutation=value;},
    stagePublication:value=>{if(!publicationAllowed)throw Error('Provider publication media integration unavailable');if(mutation)throw new Error('Duplicate staging');kind='publication';mutation=value;}
   };
   const result=await callback(Object.freeze(tx));check();if(!mutation)return result;
   if(result?.ok!==true)throw new Error('Denied transaction cannot stage writes');
   const m=mutation,receipt=receiptRef(m.receipt.actorUid,m.receipt.operation,m.receipt.requestId),audit=ref('audits',m.audit.id);
   if(await get(receipt)!==null||await get(audit)!==null)throw new Error('Receipt/audit collision');
   const owner=ref('owners',m.canonical.ownerUid),storedOwner=await get(owner);
   if(kind==='draft'){
    const identity=ref('identities',m.identity.providerId),draft=ref('drafts',m.draft.providerId),existingIdentity=await get(identity),existingDraft=await get(draft);
    if(m.mode==='create'?(storedOwner!==null||existingIdentity!==null||existingDraft!==null):(!storedOwner||storedOwner.revision!==m.canonical.revision-1||existingIdentity?.ownerUid!==m.canonical.ownerUid||existingDraft?.revision!==storedOwner.revision))throw new Error('Draft precondition conflict');
    check();raw.set(identity,{...m.identity,committedAt:sdk.serverTimestamp()});raw.set(draft,{...m.draft,committedAt:sdk.serverTimestamp()});
   }else{
    const generation=ref('generations','current'),existing=await get(generation);
    if(!existing||existing.value!==m.generation.value-1||!storedOwner||storedOwner.revision!==m.canonical.revision)throw new Error('Publication precondition conflict');
    if(m.publicProfile!==null&&(Reflect.ownKeys(m.publicProfile).sort().join(',')!==[...DISCOVERY_FIELDS].sort().join(',')||m.publicProfile.id!==m.publication.providerId||m.publicProfile.published!==true||m.publicProfile.publicationEpoch!==m.generation.value))throw new Error('Invalid public field projection');
    const media=mediaRelease?await mediaRelease.prepare(raw,m):null;if(mediaRelease&&media?.ok!==true)throw Error('Provider photos unavailable');media?.commit();
    check();raw.set(generation,{...m.generation,committedAt:sdk.serverTimestamp()});raw.set(ref('publications',m.publication.providerId),{...m.publication,committedAt:sdk.serverTimestamp()});
    if(m.publicProfile===null)raw.delete(ref('publicViews',m.publication.providerId));else raw.set(ref('publicViews',m.publication.providerId),m.publicProfile);
   }
   raw.set(owner,{...m.canonical,committedAt:sdk.serverTimestamp()});raw.set(receipt,{...m.receipt,committedAt:sdk.serverTimestamp()});raw.set(audit,{...m.audit,committedAt:sdk.serverTimestamp()});check();return result;
  },{maxAttempts:3});
 }});
}

export function getIsolatedProviderSdkContext({firestore,sdk,schema}={}){
 const unavailable=()=>{throw new Error('Isolated Provider repository unavailable');};
 const db=firestore?._delegate??firestore;
 const project=db?.app?.options?.projectId,settings=db?._getSettings?.();
 if(typeof project!=='string'||!/^demo-oldx-[a-z0-9-]{1,60}$/.test(project)||!settings||!/^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(settings.host)||Number(settings.host.split(':')[1])>65535||settings.ssl!==false)unavailable();
 if(!schema||Reflect.ownKeys(schema).sort().join(',')!==[...names].sort().join(',')||names.some(k=>typeof schema[k]!=='string'||!/^testProvider[A-Za-z0-9]{1,48}$/.test(schema[k]))||new Set(Object.values(schema)).size!==names.length||!['doc','runTransaction','serverTimestamp'].every(k=>typeof sdk?.[k]==='function'))unavailable();
 const collections=Object.freeze({...schema});
 return {db,collections};
}

const disabledProvider=()=>Object.freeze({runTransaction:()=>{throw Error('Provider repository unavailable');}});
export function createIsolatedFirebaseProviderRepository(options={}){
 if(options.enabled!==true)return disabledProvider();
 return providerRepository(options,getIsolatedProviderSdkContext(options));
}
// Real Admin SDK facade; default-off. Publication additionally requires the
// verified, binding-scoped atomic Provider media release hook. Existing branded
// exact-project/Preview/namespace/transport checks. Never initializes an app.
export function createStagingFirebaseProviderRepository(options={}){
 if(options.enabled!==true)return disabledProvider();
 const binding=requireStagingMarketplaceBinding(options.binding);
 const mediaRelease=options.mediaRelease?requireProviderMediaRelease(options.mediaRelease,binding):null;
 return providerRepository({...options,sdk:binding.sdk,mediaRelease,photoPolicy:mediaRelease??options.photoPolicy,publicationAllowed:!!mediaRelease},{db:binding.db,collections:binding.providerCollections});
}
