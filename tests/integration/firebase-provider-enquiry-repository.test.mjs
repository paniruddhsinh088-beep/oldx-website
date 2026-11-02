import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedFirebaseEnquiryRepository,PROVIDER_ENQUIRY_TEST_SCHEMA,enquiryBlockKeyForTests} from '../../scripts/firebase-provider-enquiry-repository.mjs';
import {createProviderEnquiryTransaction} from '../../scripts/provider-enquiry-transaction.mjs';
import {fakeFirestoreSdk,SDK_TEST_SCHEMA} from './fake-firestore-sdk.mjs';

const schema={...SDK_TEST_SCHEMA,...PROVIDER_ENQUIRY_TEST_SCHEMA};
const request={requestId:'enquiry-one',providerId:'p1',expectedPublicationGeneration:1,service:'Plumber',description:'Repair sample tap',timing:'flexible'};
const detail={kind:'enquiry',providerId:'p1',enquiryId:'e1',expectedRevision:0};
function fixture(){
 const f=fakeFirestoreSdk();
 f.seed(schema.generations,'current',{value:1});
 f.seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:false});
 f.seed(schema.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});
 f.seed(schema.owners,'owner',{providerId:'p1',ownerUid:'owner',revision:1,status:'published'});
 f.seed(schema.identities,'p1',{providerId:'p1',ownerUid:'owner'});
 f.seed(schema.publications,'p1',{providerId:'p1',ownerUid:'owner',published:true,services:['Plumber'],publicationEpoch:1});
 f.seed(schema.publicViews,'p1',{id:'p1',displayName:'Sample',city:'Ahmedabad',serviceArea:'Sample area',services:['Plumber'],available:true,experienceYears:2,description:'Sample',languages:['en'],published:true,publicationEpoch:1});
 f.seed(schema.buyerActors,'buyer',{uid:'buyer',canEnquire:true,suspended:false});
 f.seed(schema.participantBlocks,enquiryBlockKeyForTests('buyer','owner'),{fromUid:'buyer',toUid:'owner',blocked:false});
 f.seed(schema.participantBlocks,enquiryBlockKeyForTests('owner','buyer'),{fromUid:'owner',toUid:'buyer',blocked:false});
 const repository=createIsolatedFirebaseEnquiryRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema});
 const create=()=>createProviderEnquiryTransaction({enabled:true,authenticate:()=>({uid:'buyer'}),repository,allocateId:()=> 'e1'});
 return {f,repository,create};
}
test('SDK enquiry adapter is disabled and rejects real projects, remote hosts and foreign schemas',async()=>{
 assert.throws(()=>createIsolatedFirebaseEnquiryRepository().runTransaction(()=>{}));
 const f=fakeFirestoreSdk();
 for(const db of [{...f.db,app:{options:{projectId:'oldx-staging'}}},{...f.db,_getSettings:()=>({host:'firestore.googleapis.com:443',ssl:true})}])assert.throws(()=>createIsolatedFirebaseEnquiryRepository({enabled:true,firestore:db,sdk:f.sdk,schema}));
 assert.throws(()=>createIsolatedFirebaseEnquiryRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:{...schema,enquiries:'users'}}));
 assert.equal(f.calls,0);
});
test('SDK atomic creation and replay persist one private record, receipt and audit, with fresh participant reads',async()=>{
 const {f,create,repository}=fixture();
 const outcomes=await Promise.all([create().create(request),create().create(request)]);
 assert.deepEqual(outcomes.map(r=>r.status).sort(),['created','replayed']);
 assert.equal(f.commits,1);
 assert.equal(f.get(schema.enquiries,'e1').note,request.description);
 const buyer=await repository.readPrivate(detail,'buyer');
 const provider=await repository.readPrivate(detail,'owner');
 assert.equal(buyer.ok,true);assert.equal(provider.ok,true);
 assert.equal(buyer.value.note,request.description);
 assert.equal(Object.hasOwn(buyer.value,'buyerUid'),false);
 assert.equal((await repository.readPrivate(detail,'foreign')).ok,false);
 assert.equal((await create().create({...request,description:'Different note'})).code,'IDEMPOTENCY_CONFLICT');
 assert.equal(f.commits,1);
});
test('revoked publication, missing or active blocks, actor suspension and tampered canonical data fail closed',async()=>{
 for(const change of ['withdraw','block','missing-block','suspend','foreign-owner','view-mismatch']){
  const {f,create,repository}=fixture();
  if(change==='withdraw')f.seed(schema.publications,'p1',{...f.get(schema.publications,'p1'),published:false});
  if(change==='block')f.seed(schema.participantBlocks,enquiryBlockKeyForTests('owner','buyer'),{fromUid:'owner',toUid:'buyer',blocked:true});
  if(change==='missing-block')f.seed(schema.participantBlocks,enquiryBlockKeyForTests('owner','buyer'),{fromUid:'owner',toUid:'other',blocked:false});
  if(change==='suspend')f.seed(schema.buyerActors,'buyer',{uid:'buyer',canEnquire:true,suspended:true});
  if(change==='foreign-owner')f.seed(schema.identities,'p1',{providerId:'p1',ownerUid:'foreign'});
  if(change==='view-mismatch')f.seed(schema.publicViews,'p1',{...f.get(schema.publicViews,'p1'),publicationEpoch:0});
  const result=await create().create(request);
  assert.equal(result.ok,false,change);
  assert.equal(f.commits,0,change);
  assert.equal((await repository.readPrivate(detail,'buyer')).ok,false,change);
 }
});
test('SDK commit failures cannot partially save private record, receipt or audit',async()=>{
 for(const failure of ['failSet','failCommit']){
  const {f,create}=fixture();const before=f.snapshot();f[failure]=true;
  const result=await create().create(request);
  assert.equal(result.code,'OUTCOME_UNKNOWN');
  assert.deepEqual(f.snapshot(),before);
 }
});
test('foreign staged payloads, pre-aborted operations and invalid deadlines cannot mutate',async()=>{
 const {f,repository,create}=fixture();
 const controller=new AbortController();controller.abort();
 assert.equal((await create().create(request,{signal:controller.signal})).code,'CANCELLED');
 assert.equal(f.calls,0);
 await assert.rejects(repository.runTransaction(async tx=>{
  tx.stageEnquiry({record:{id:'e1'},receipt:{},audit:{}});return {ok:true,status:'created',enquiryId:'e1'};
 },{deadlineAt:Date.now()+5000}));
 await assert.rejects(repository.runTransaction(async()=>({ok:true}),{deadlineAt:0}));
 assert.equal(f.commits,0);
});
