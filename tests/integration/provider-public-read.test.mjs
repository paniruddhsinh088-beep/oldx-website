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
