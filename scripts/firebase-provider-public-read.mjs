import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createStagingProviderQuerySdk} from './staging-provider-query-sdk.mjs';
import {createBoundedRead} from '../features/shared/bounded-read.mjs';
import {getIsolatedProviderSdkContext} from './firebase-provider-repository.mjs';
import {createPublicProviderRepository,planPublicProviderQuery,DISCOVERY_FIELDS,projectPublicRow} from '../features/service-providers/provider-discovery.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0;
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).sort().join(',')!==[...keys].sort().join(','))throw new Error('Invalid public snapshot');return value;}
function data(snapshot){if(!snapshot.exists())return null;const {committedAt,...facts}=snapshot.data();return facts;}
// Emulator-only bridge: fresh SDK server query + transactional generation,
// ownership and canonical publication barrier. No cache, app or credentials.
function providerPublicRead({sdk,catalog,now=Date.now,timeoutMs=5000}={}, {db,collections}){
 if(!['collection','query','where','orderBy','limit','startAfter','getDocsFromServer','getDocFromServer'].every(k=>typeof sdk[k]==='function')||!planPublicProviderQuery({category:'',locality:'',limit:1,cursor:null},catalog,{publicationEpoch:0})||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new Error('Public read configuration unavailable');
 const trusted={services:[...catalog.services],localities:catalog.localities.map(l=>({...l}))};
 const ref=(name,key)=>{if(!id(key))throw new Error('Invalid identifier');return sdk.doc(db,collections[name],key);};
 const check=(signal,deadline)=>{if(signal?.aborted||now()>=deadline)throw new Error('Public read stopped');};
 const generation=async(signal,deadline)=>{check(signal,deadline);const snap=await sdk.getDocFromServer(ref('generations','current'));check(signal,deadline);if(snap.metadata?.fromCache!==false||snap.metadata?.hasPendingWrites!==false)throw new Error('Untrusted snapshot');const value=exact(data(snap),['value']).value;if(!integer(value))throw new Error('Invalid generation');return value;};
 async function canonical(raw,providerId,global,signal,deadline){
  check(signal,deadline);const publication=data(await raw.get(ref('publications',providerId)));check(signal,deadline);
  if(!publication)return null;exact(publication,['providerId','ownerUid','published','services','publicationEpoch']);
  if(publication.providerId!==providerId||!id(publication.ownerUid)||publication.published!==true||!integer(publication.publicationEpoch)||publication.publicationEpoch>global||!Array.isArray(publication.services)||publication.services.length<1||publication.services.length>12||publication.services.some(category=>!trusted.services.includes(category))||new Set(publication.services).size!==publication.services.length)throw new Error('Invalid canonical publication');
  const identity=data(await raw.get(ref('identities',providerId))),owner=data(await raw.get(ref('owners',publication.ownerUid))),actor=data(await raw.get(ref('actors',publication.ownerUid)));check(signal,deadline);
  if(actor?.uid!==publication.ownerUid||actor.canWrite!==true||actor.suspended!==false)throw new Error('Inactive Provider owner');
  if(identity?.providerId!==providerId||identity.ownerUid!==publication.ownerUid||owner?.providerId!==providerId||owner.ownerUid!==publication.ownerUid||owner.status!=='published')throw new Error('Invalid canonical identity');
  return publication;
 }
 function validatePlan(plan){
  exact(plan,['view','fields','where','orderBy','limit','after','publicationEpoch']);if(!integer(plan.publicationEpoch)||!Array.isArray(plan.where)||plan.where.length>3)throw new Error('Invalid query');
  let expected;
  if(plan.where[0]?.[0]==='id'){
   const providerId=plan.where[0]?.[2];if(!id(providerId))throw new Error('Invalid detail scope');
   expected={view:'public-provider-discovery-v1',fields:DISCOVERY_FIELDS,where:[['id','==',providerId],['published','==',true]],orderBy:['id','asc'],limit:1,after:null,publicationEpoch:plan.publicationEpoch};
  }else{
   const category=plan.where.find(c=>c[0]==='services')?.[2]??'',locality=plan.where.find(c=>c[0]==='serviceArea')?.[2]??'';
   expected=planPublicProviderQuery({category,locality,limit:plan.limit-1,cursor:null},trusted,{publicationEpoch:plan.publicationEpoch,after:plan.after});
  }
  if(!expected||JSON.stringify(expected)!==JSON.stringify(plan))throw new Error('Unbounded or foreign query');
 }
 async function bounded(work,signal){
  if(signal?.aborted)throw new Error('Public read stopped');let state={status:'idle'};
  const lifecycle=createBoundedRead({timeoutMs,read:(_,context)=>work(context.signal,now()+timeoutMs),project:value=>({value}),onChange:next=>{state=next;}}),abort=()=>lifecycle.clear();
  signal?.addEventListener('abort',abort,{once:true});
  try{await lifecycle.load({});if(state.status!=='ready')throw new Error('Public read unavailable');return state.snapshot.value;}finally{signal?.removeEventListener('abort',abort);}
 }
 return Object.freeze({
  getPublicationEpoch:({signal}={})=>bounded((inner,deadline)=>generation(inner,deadline),signal),
  async readCanonical(providerId,{signal}={}){
   return bounded(async(signal,deadline)=>{check(signal,deadline);if(!id(providerId))throw new Error('Invalid provider ID');
   return sdk.runTransaction(db,async raw=>{const g=exact(data(await raw.get(ref('generations','current'))),['value']).value;if(!integer(g))throw new Error('Invalid generation');const current=await canonical(raw,providerId,g,signal,deadline);check(signal,deadline);return current?{providerId,services:[...current.services],published:true,publicationEpoch:g}:null;},{maxAttempts:3});},signal);
  },
  async query(plan,{signal}={}){
   validatePlan(plan);return bounded(async(signal,deadline)=>{if(await generation(signal,deadline)!==plan.publicationEpoch)throw new Error('Stale generation');
   const constraints=[...plan.where.map(c=>sdk.where(...c)),sdk.orderBy(...plan.orderBy),...(plan.after?[sdk.startAfter(plan.after)]:[]),sdk.limit(plan.limit)];
   const snapshot=await sdk.getDocsFromServer(sdk.query(sdk.collection(db,collections.publicViews),...constraints));check(signal,deadline);
   if(snapshot.metadata?.fromCache!==false||snapshot.metadata?.hasPendingWrites!==false||!Array.isArray(snapshot.docs)||snapshot.docs.length>plan.limit)throw new Error('Invalid server page');
   const rows=snapshot.docs.map(doc=>{const row=exact(doc.data(),DISCOVERY_FIELDS);if(doc.metadata?.fromCache!==false||doc.metadata?.hasPendingWrites!==false||row.id!==doc.id||row.published!==true||!integer(row.publicationEpoch)||row.publicationEpoch>plan.publicationEpoch||!projectPublicRow(row,trusted,row.publicationEpoch))throw new Error('Invalid public row');return structuredClone(row);});
   const result=await sdk.runTransaction(db,async raw=>{
    const g=exact(data(await raw.get(ref('generations','current'))),['value']).value;check(signal,deadline);if(g!==plan.publicationEpoch)throw new Error('Publication changed during query');
    for(const row of rows){const currentRow=data(await raw.get(ref('publicViews',row.id)));if(!currentRow||!exact(currentRow,DISCOVERY_FIELDS)||JSON.stringify(DISCOVERY_FIELDS.map(k=>[k,currentRow[k]]))!==JSON.stringify(DISCOVERY_FIELDS.map(k=>[k,row[k]])))throw new Error('Public Provider changed during query');const current=await canonical(raw,row.id,g,signal,deadline);if(!current||current.publicationEpoch!==row.publicationEpoch||JSON.stringify(current.services)!==JSON.stringify(row.services))throw new Error('Stale public row');}
    // Only after the barrier may a stored per-row version be represented as the
    // existing port's current dataset snapshot epoch. It is never a cache stamp.
    return {publicationEpoch:g,rows:rows.map(row=>({...row,publicationEpoch:g}))};
   },{maxAttempts:3});
   if(await generation(signal,deadline)!==plan.publicationEpoch)throw new Error('Publication changed after query');return result;},signal);
  }
 });
}

const disabledRead=()=>{const unavailable=async()=>{throw Error('Public read unavailable');};return Object.freeze({getPublicationEpoch:unavailable,query:unavailable,readCanonical:unavailable});};
export function createIsolatedProviderPublicRead(options={}){
 if(options.enabled!==true)return disabledRead();
 return providerPublicRead(options,getIsolatedProviderSdkContext(options));
}
// Real Admin SDK path, default-off and bound to existing exact-project gates.
export function createStagingProviderPublicRead(options={}){
 if(options.enabled!==true)return disabledRead();
 const b=requireStagingMarketplaceBinding(options.binding),sdk=createStagingProviderQuerySdk({binding:b});
 return providerPublicRead({...options,sdk},{db:b.db,collections:b.providerCollections});
}
export function createStagingPublicProviderRepository(options={}){
 return createPublicProviderRepository({...options,...createStagingProviderPublicRead(options)});
}
