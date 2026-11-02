import test from 'node:test';import assert from 'node:assert/strict';
import {createIsolatedFirebaseProviderRepository} from '../../scripts/firebase-provider-repository.mjs';
import {createProviderDraftTransaction} from '../../scripts/provider-draft-transaction.mjs';
import {createProviderPublicationTransaction} from '../../scripts/provider-publication-transaction.mjs';
import {fakeFirestoreSdk,SDK_TEST_SCHEMA as schema} from './fake-firestore-sdk.mjs';
const profile={displayName:'Sample',city:'Sample City',serviceArea:'Sample area',services:['Plumber'],description:'Sample only',experienceYears:2,available:true,languages:['en']};
const catalog={services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample area'}]};
function fixture(){const f=fakeFirestoreSdk();f.seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:false});f.seed(schema.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});f.seed(schema.generations,'current',{value:0});const repo=createIsolatedFirebaseProviderRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema});const draft=createProviderDraftTransaction({enabled:true,authenticate:()=>({uid:'owner'}),repository:repo,providerIdForActor:()=> 'p1'}),publication=createProviderPublicationTransaction({enabled:true,authenticate:()=>({uid:'owner'}),repository:repo,catalog});return {f,repo,draft,publication};}
const save=(draft,key='draft-1',revision=0)=>draft.save({requestId:key,expectedRevision:revision,profile});
const command=(action='publish',expectedGeneration=0,requestId='publish-1')=>({requestId,expectedRevision:1,expectedGeneration,action});
test('SDK adapter defaults disabled and rejects real projects, remote endpoints, SSL and legacy schemas before any operation',async()=>{
 const f=fakeFirestoreSdk();assert.throws(()=>createIsolatedFirebaseProviderRepository().runTransaction(()=>{}));
 for(const db of [{...f.db,app:{options:{projectId:'oldx-staging'}}},{...f.db,_getSettings:()=>({host:'firestore.googleapis.com:443',ssl:true})},{...f.db,_getSettings:()=>({host:'127.0.0.1:8084',ssl:true})}])assert.throws(()=>createIsolatedFirebaseProviderRepository({enabled:true,firestore:db,sdk:f.sdk,schema}));
 assert.throws(()=>createIsolatedFirebaseProviderRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:{...schema,drafts:'users'}}));assert.equal(f.calls,0);
});
test('real SDK API mapping composes private draft transaction, metadata reads, server timestamps and idempotent audit',async()=>{
 const {f,draft}=fixture();assert.equal((await save(draft)).status,'saved');assert.equal((await save(draft)).status,'replayed');assert.equal(f.commits,1);assert.equal(f.get(schema.drafts,'p1').revision,1);assert.ok(f.get(schema.drafts,'p1').committedAt);assert.equal(f.get(schema.publicViews,'p1'),null);assert.equal(f.get(schema.generations,'current').value,0);
 assert.equal((await save(draft,'draft-2',1)).revision,2);assert.equal(f.get(schema.owners,'owner').revision,2);
});
test('publication materializes only approved public fields and atomically withdraws with generation, receipt and audit',async()=>{
 const {f,draft,publication}=fixture();await save(draft);const result=await publication.execute(command());assert.equal(result.status,'applied');assert.equal(result.generation,1);
 const publicView=f.get(schema.publicViews,'p1');assert.equal(publicView.id,'p1');for(const field of ['ownerUid','profile','phone','credential','committedAt'])assert.equal(Object.hasOwn(publicView,field),false);assert.equal(publicView.publicationEpoch,1);assert.equal(f.get(schema.generations,'current').value,1);assert.equal(f.get(schema.owners,'owner').status,'published');
 assert.equal((await publication.execute(command())).status,'replayed');assert.equal(f.commits,2);
 assert.equal((await publication.execute(command('withdraw',1,'withdraw-1'))).generation,2);assert.equal(f.get(schema.publicViews,'p1'),null);assert.equal(f.get(schema.publications,'p1').published,false);assert.equal(f.get(schema.generations,'current').value,2);assert.equal((await publication.execute(command('withdraw',1,'withdraw-1'))).status,'replayed');assert.equal(f.commits,3);
});
test('independent publication permission, ownership, suspension, invalid source/private fields and generation conflicts deny',async()=>{
 const {f,draft,publication}=fixture();await save(draft);f.seed(schema.permissions,'owner',{uid:'owner',canPublish:false,canWithdraw:true,suspended:false});assert.equal((await publication.execute(command())).code,'DENIED');
 f.seed(schema.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});const source=f.get(schema.drafts,'p1');source.profile.phone='private';f.seed(schema.drafts,'p1',source);assert.equal((await publication.execute(command())).code,'INVALID_PUBLIC_PROFILE');assert.equal(f.get(schema.publicViews,'p1'),null);
 delete source.profile.phone;f.seed(schema.drafts,'p1',source);assert.equal((await publication.execute({...command(),expectedGeneration:2})).code,'REVISION_CONFLICT');assert.equal((await publication.execute({...command(),ownerUid:'forged'})).code,'INVALID_REQUEST');
 f.seed(schema.identities,'p1',{providerId:'p1',ownerUid:'foreign'});assert.equal((await publication.execute(command())).code,'DENIED');assert.equal(f.commits,1);
});
test('SDK staging/commit errors leave no partial public view, generation, receipt or audit',async()=>{
 for(const failure of ['failSet','failCommit']){const {f,draft,publication}=fixture();await save(draft);const before=f.snapshot();f[failure]=true;const result=await publication.execute(command());assert.equal(result.code,'OUTCOME_UNKNOWN');assert.deepEqual(f.snapshot(),before);assert.equal(JSON.stringify(result).includes('private'),false);}
});
test('same-key mismatch, concurrent generation conflict, revoked replay and independent withdrawal stay safe',async()=>{
 const {f,draft,publication}=fixture();await save(draft);const outcomes=await Promise.all([publication.execute(command()),publication.execute(command('publish',0,'other'))]);assert.equal(outcomes.filter(r=>r.ok).length,1);assert.equal(outcomes.find(r=>!r.ok).code,'REVISION_CONFLICT');
 assert.equal((await publication.execute(command('withdraw',1,'publish-1'))).code,'IDEMPOTENCY_CONFLICT');
 f.seed(schema.permissions,'owner',{uid:'owner',canPublish:false,canWithdraw:true,suspended:false});assert.equal((await publication.execute(command())).code,'DENIED');const owner=f.get(schema.owners,'owner');owner.status='suspended';f.seed(schema.owners,'owner',owner);assert.equal((await publication.execute(command('withdraw',1,'withdraw'))).ok,true);assert.equal(f.get(schema.publicViews,'p1'),null);
});

test('publication cancellation settles ignored SDK startup and prevents late staging',async()=>{
 const {f,draft,repo}=fixture();await save(draft);let release,expire;const original=f.sdk.runTransaction;f.sdk.runTransaction=(...args)=>new Promise(r=>release=r).then(()=>original(...args));
 const publication=createProviderPublicationTransaction({enabled:true,authenticate:()=>({uid:'owner'}),repository:repo,catalog,schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});const pending=publication.execute(command());for(let turns=0;!release&&turns<20;turns++)await new Promise(r=>setImmediate(r));assert.equal(typeof release,'function');expire();assert.equal((await pending).code,'OUTCOME_UNKNOWN');release();await new Promise(r=>setImmediate(r));assert.equal(f.commits,1);assert.equal(f.get(schema.publicViews,'p1'),null);
});
test('SDK adapter rejects a raw staged public payload containing private fields',async()=>{
 const {f,repo}=fixture();const before=f.snapshot();const mutation={canonical:{providerId:'p1',ownerUid:'owner',revision:0,status:'published'},publication:{providerId:'p1'},generation:{value:1},publicProfile:{id:'p1',ownerUid:'private'},receipt:{actorUid:'owner',operation:'publication',requestId:'raw'},audit:{id:'a'.repeat(64)}};
 f.seed(schema.owners,'owner',mutation.canonical);const seeded=f.snapshot();await assert.rejects(repo.runTransaction(async tx=>{tx.stagePublication(mutation);return {ok:true};},{signal:new AbortController().signal,deadlineAt:Date.now()+1000}));assert.deepEqual(f.snapshot(),seeded);assert.equal(f.get(schema.publicViews,'p1'),null);
});
