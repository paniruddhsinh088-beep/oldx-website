import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk,SDK_TEST_SCHEMA as schema} from './fake-firestore-sdk.mjs';
import {createIsolatedFirebaseProviderRepository} from '../../scripts/firebase-provider-repository.mjs';
import {createIsolatedProviderPublicRead} from '../../scripts/firebase-provider-public-read.mjs';
import {createPublicProviderRepository} from '../../features/service-providers/provider-discovery.mjs';
import {createProviderDraftTransaction} from '../../scripts/provider-draft-transaction.mjs';
import {createProviderPublicationTransaction} from '../../scripts/provider-publication-transaction.mjs';
const catalog={services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample area'}]};
const request={category:'',locality:'',limit:1,cursor:null};
async function fixture(){const f=fakeFirestoreSdk();f.seed(schema.generations,'current',{value:0});const repository=createIsolatedFirebaseProviderRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema});let generation=0;const pubs={};
 for(const [uid,providerId] of [['one','p1'],['two','p2']]){f.seed(schema.actors,uid,{uid,canWrite:true,suspended:false});f.seed(schema.permissions,uid,{uid,canPublish:true,canWithdraw:true,suspended:false});const authenticate=()=>({uid});const draft=createProviderDraftTransaction({enabled:true,authenticate,repository,providerIdForActor:()=>providerId});assert.equal((await draft.save({requestId:'draft',expectedRevision:0,profile:{displayName:providerId,city:'Sample City',serviceArea:'Sample area',services:['Plumber'],description:'Public sample',available:true,experienceYears:2,languages:['en']}})).ok,true);pubs[uid]=createProviderPublicationTransaction({enabled:true,authenticate,repository,catalog});assert.equal((await pubs[uid].execute({requestId:'publish',expectedRevision:1,expectedGeneration:generation++,action:'publish'})).ok,true);}
 const bridge=createIsolatedProviderPublicRead({enabled:true,firestore:f.db,sdk:f.sdk,schema,catalog}),tokens=new Map();let sequence=0;const publicRepository=createPublicProviderRepository({enabled:true,catalog,...bridge,readCursor:t=>tokens.get(t),issueCursor:s=>{const token='cursor_'+(++sequence);tokens.set(token,s);return token;}});return {f,bridge,publicRepository,pubs};
}
test('consistent bridge supports different per-row versions, current snapshot epochs, detail and scoped cursor replay',async()=>{
 const {f,publicRepository}=await fixture();assert.equal(f.get(schema.publicViews,'p1').publicationEpoch,1);assert.equal(f.get(schema.publicViews,'p2').publicationEpoch,2);
 const first=await publicRepository.discover(request);assert.equal(first.ok,true);assert.equal(first.publicationEpoch,2);assert.deepEqual(first.items.map(p=>p.id),['p1']);const next=await publicRepository.discover({...request,cursor:first.nextCursor});assert.deepEqual(next.items.map(p=>p.id),['p2']);assert.deepEqual((await publicRepository.discover({...request,cursor:first.nextCursor})).items,next.items);
 assert.equal((await publicRepository.discover({...request,limit:2,cursor:first.nextCursor})).ok,false);const detail=await publicRepository.detail({providerId:'p1',expectedGeneration:2});assert.equal(detail.ok,true);assert.equal(Object.hasOwn(detail.profile,'ownerUid'),false);
});
test('withdrawal during query rejects page and old cursor; unchanged older rows remain discoverable under new generation',async()=>{
 const {f,publicRepository,pubs}=await fixture();const first=await publicRepository.discover(request);const query=f.sdk.getDocsFromServer;let fired=false;f.sdk.getDocsFromServer=async(...args)=>{const page=await query(...args);if(!fired){fired=true;await pubs.one.execute({requestId:'withdraw',expectedRevision:1,expectedGeneration:2,action:'withdraw'});}return page;};
 assert.equal((await publicRepository.discover(request)).ok,false);assert.equal((await publicRepository.discover({...request,cursor:first.nextCursor})).ok,false);const fresh=await publicRepository.discover(request);assert.equal(fresh.ok,true);assert.deepEqual(fresh.items.map(p=>p.id),['p2']);assert.equal(fresh.publicationEpoch,3);assert.equal((await publicRepository.detail({providerId:'p1',expectedGeneration:null})).ok,false);
});
test('private extra fields, stale versions, forged document/identity relationships and cached SDK responses fail closed',async()=>{
 for(const patch of [{ownerUid:'private'},{publicationEpoch:0},{id:'foreign'},{description:{private:'data'}}]){const {f,publicRepository}=await fixture();f.seed(schema.publicViews,'p1',{...f.get(schema.publicViews,'p1'),...patch});assert.equal((await publicRepository.discover(request)).ok,false);}
 const {f,publicRepository}=await fixture();f.seed(schema.identities,'p1',{providerId:'p1',ownerUid:'foreign'});assert.equal((await publicRepository.detail({providerId:'p1',expectedGeneration:2})).ok,false);
 const cached=await fixture(),read=cached.f.sdk.getDocsFromServer;cached.f.sdk.getDocsFromServer=async(...args)=>({...await read(...args),metadata:{fromCache:true,hasPendingWrites:false}});assert.equal((await cached.publicRepository.discover(request)).ok,false);
});
test('disabled bridge never touches SDK; arbitrary/unbounded plans and pre-aborted reads are rejected',async()=>{
 await assert.rejects(createIsolatedProviderPublicRead().getPublicationEpoch());const {bridge,f}=await fixture();const abort=new AbortController();abort.abort();await assert.rejects(bridge.getPublicationEpoch({signal:abort.signal}));await assert.rejects(bridge.query({view:'users',limit:10000}));f.sdk.getDocFromServer=()=>new Promise(()=>{});const deadline=createIsolatedProviderPublicRead({enabled:true,firestore:f.db,sdk:f.sdk,schema,catalog,timeoutMs:1});await assert.rejects(deadline.getPublicationEpoch());
});

test('suspension without generation change and changed public bytes during query fail closed',async()=>{
 const suspended=await fixture();suspended.f.seed(schema.actors,'one',{uid:'one',canWrite:true,suspended:true});assert.equal((await suspended.publicRepository.discover(request)).ok,false);assert.equal((await suspended.publicRepository.detail({providerId:'p1',expectedGeneration:2})).ok,false);
 const changed=await fixture(),read=changed.f.sdk.getDocsFromServer;changed.f.sdk.getDocsFromServer=async(...args)=>{const result=await read(...args);changed.f.seed(schema.publicViews,'p1',{...changed.f.get(schema.publicViews,'p1'),description:'Changed after query'});return result;};assert.equal((await changed.publicRepository.discover(request)).ok,false);
});

test('native Provider query facade uses public SELECT and rejects private/unbounded queries',async()=>{
 const {createStagingMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs'),{createStagingProviderQuerySdk}=await import('../../scripts/staging-provider-query-sdk.mjs'),{exerciseNativeProviderReads}=await import('./provider-native-read-cases.mjs');
 const f=fakeFirestoreSdk();let selected=[];
 function collection(name){return {doc:id=>({path:name+'/'+id,get:async()=>({id,exists:f.get(name,id)!==null,data:()=>f.get(name,id)})}),select(...fields){selected=fields;const constraints=[];const query={where:(...args)=>{constraints.push(f.sdk.where(...args));return query;},orderBy:(...args)=>{constraints.push(f.sdk.orderBy(...args));return query;},startAfter:value=>{constraints.push(f.sdk.startAfter(value));return query;},limit:value=>{constraints.push(f.sdk.limit(value));return query;},get:async()=>{const result=await f.sdk.getDocsFromServer(f.sdk.query(f.sdk.collection(f.db,name),...constraints));return {docs:result.docs.map(doc=>({id:doc.id,exists:true,data:()=>Object.fromEntries(fields.filter(k=>Object.hasOwn(doc.data(),k)).map(k=>[k,doc.data()[k]]))}))};}};return query;}};}
 const adminFirestore={projectId:'oldx-staging',collection,runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,tx=>work({get:async ref=>{const snap=await tx.get(ref);return {exists:snap.exists(),data:snap.data};},set:(...a)=>tx.set(...a),delete:(...a)=>tx.delete(...a)}),opts)};
 const binding=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}}),sdk=createStagingProviderQuerySdk({binding});
 assert.throws(()=>sdk.collection(adminFirestore,binding.providerCollections.drafts));assert.throws(()=>sdk.where('ownerUid','==','owner'));assert.throws(()=>sdk.where('published','==',false));assert.throws(()=>sdk.limit(26));assert.throws(()=>sdk.orderBy('createdAt','desc'));
 const c=sdk.collection(adminFirestore,binding.providerCollections.publicViews);assert.throws(()=>sdk.query(c,sdk.orderBy('id','asc'),sdk.limit(2)));await assert.rejects(sdk.getDocsFromServer({}));
 await exerciseNativeProviderReads({binding,seed:(...a)=>f.seed(...a)});assert.deepEqual(selected,['id','displayName','city','serviceArea','services','available','experienceYears','description','languages','published','publicationEpoch']);
});
