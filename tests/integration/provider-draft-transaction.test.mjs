import test from 'node:test';import assert from 'node:assert/strict';
import {createProviderDraftTransaction} from '../../scripts/provider-draft-transaction.mjs';
import {fakeProviderTransactions} from './fake-provider-transactions.mjs';
const profile={displayName:'Sample',city:'Sample City',serviceArea:'Sample area',services:['Plumber'],description:'Sample only',experienceYears:2,available:true,languages:['en']};
const request=(requestId='request-1',expectedRevision=0,patch={})=>({requestId,expectedRevision,profile:{...profile,...patch}});
const adapter=(repository,options={})=>createProviderDraftTransaction({enabled:true,authenticate:()=>({uid:'owner'}),repository,providerIdForActor:()=> 'p1',...options});
test('disabled/invalid requests cannot authenticate or touch repository; ownership/role/publication injection is rejected',async()=>{
 let calls=0;const repo=fakeProviderTransactions();assert.equal((await createProviderDraftTransaction({authenticate:()=>calls++}).save(request())).code,'UNAVAILABLE');
 for(const patch of [{ownerUid:'foreign'},{role:'admin'},{providerId:'p2'},{profile:{...profile,published:true}},{profile:{...profile,phone:'private'}}])assert.equal((await adapter(repo,{authenticate:()=>calls++}).save({...request(),...patch})).code,'INVALID_REQUEST');
 assert.equal(calls,0);assert.equal(repo.attempts,0);
});
test('atomic create/update emits only private allowlisted data, receipt and minimal audit without changing public views',async()=>{
 const repo=fakeProviderTransactions(),save=adapter(repo),before=repo.snapshot().publicViews;
 assert.deepEqual(await save.save(request()),{ok:true,status:'saved',providerId:'p1',revision:1});
 const created=repo.snapshot();assert.equal(created.owners.owner.status,'draft');assert.equal(created.drafts.p1.ownerUid,'owner');assert.deepEqual(Object.keys(created.drafts.p1).sort(),['ownerUid','profile','providerId','revision']);assert.equal(Object.keys(created.audits).length,1);assert.equal(JSON.stringify(created.audits).includes('Sample only'),false);
 assert.deepEqual(await save.save(request('request-2',1,{description:'New private draft'})),{ok:true,status:'saved',providerId:'p1',revision:2});assert.equal(repo.commits,2);assert.deepEqual(repo.snapshot().publicViews,before);
 const stale=await save.save(request('request-3',1));assert.equal(stale.code,'REVISION_CONFLICT');assert.equal(repo.commits,2);
});
test('same-key replay is stable across later writes; changed payload/revision conflicts and replay revalidates suspension',async()=>{
 const repo=fakeProviderTransactions(),save=adapter(repo);await save.save(request());await save.save(request('request-2',1));
 assert.deepEqual(await save.save(request()),{ok:true,status:'replayed',providerId:'p1',revision:1});assert.equal(repo.commits,2);
 assert.equal((await save.save(request('request-1',0,{description:'different'}))).code,'IDEMPOTENCY_CONFLICT');assert.equal((await save.save(request('request-1',2))).code,'IDEMPOTENCY_CONFLICT');
 repo.change(s=>s.actors.owner.suspended=true);assert.equal((await save.save(request())).code,'DENIED');assert.equal(repo.commits,2);
});
test('simultaneous create and update races yield one winner; same-key races replay without duplicate audit',async()=>{
 const repo=fakeProviderTransactions(),save=adapter(repo);const [a,b]=await Promise.all([save.save(request()),save.save(request('other'))]);assert.equal([a,b].filter(r=>r.ok).length,1);assert.equal(repo.commits,1);
 const [c,d]=await Promise.all([save.save(request('next',1)),save.save(request('next',1))]);assert.deepEqual([c.status,d.status],['saved','replayed']);assert.equal(repo.commits,2);assert.equal(Object.keys(repo.snapshot().audits).length,2);
 const updates=await Promise.all([save.save(request('update-a',2,{description:'A'})),save.save(request('update-b',2,{description:'B'}))]);assert.equal(updates.filter(r=>r.ok).length,1);assert.equal(updates.find(r=>!r.ok).code,'REVISION_CONFLICT');assert.equal(repo.commits,3);
});
test('ownership/collision/suspension changes are checked inside transactional retries, not trusted from preparation',async()=>{
 const repo=fakeProviderTransactions();repo.afterReads=r=>r.change(s=>s.actors.owner.suspended=true);assert.equal((await adapter(repo).save(request())).code,'DENIED');assert.equal(repo.attempts,2);assert.equal(repo.commits,0);
 const foreign=fakeProviderTransactions();foreign.change(s=>s.drafts.p1={providerId:'p1',ownerUid:'foreign',revision:1});assert.equal((await adapter(foreign).save(request())).code,'DENIED');assert.equal(foreign.commits,0);
 const reserved=fakeProviderTransactions();reserved.change(s=>s.identities.p1={providerId:'p1',ownerUid:'foreign'});assert.equal((await adapter(reserved).save(request())).code,'DENIED');assert.equal(reserved.commits,0);
 const moved=fakeProviderTransactions();await adapter(moved).save(request());moved.change(s=>s.owners.owner.ownerUid='foreign');assert.equal((await adapter(moved).save(request('next',1))).code,'DENIED');moved.change(s=>{s.owners.owner.ownerUid='owner';s.owners.owner.status='suspended';});assert.equal((await adapter(moved).save(request('next',1))).code,'DENIED');
});
test('audit/stage or commit failure rolls back fake state; uncertain/lost acknowledgement is safely replayable',async()=>{
 for(const flag of ['failStage','failCommit']){const repo=fakeProviderTransactions();repo[flag]=true;const before=repo.snapshot();const result=await adapter(repo).save(request(),{credential:'private-token'});assert.equal(result.code,'OUTCOME_UNKNOWN');assert.deepEqual(repo.snapshot(),before);assert.equal(JSON.stringify(result).includes('private'),false);}
 const repo=fakeProviderTransactions();repo.loseAck=true;const save=adapter(repo);assert.equal((await save.save(request())).code,'OUTCOME_UNKNOWN');assert.equal(repo.commits,1);assert.equal((await save.save(request())).status,'replayed');assert.equal(repo.commits,1);
});
test('deadline/cancellation before commit cannot stage late writes; outcome remains unknown once transaction attempted',async()=>{
 let release,expire;const repo=fakeProviderTransactions();repo.afterReads=()=>new Promise(r=>release=r);
 const save=adapter(repo,{schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});const task=save.save(request());for(let turns=0;!release&&turns<20;turns++)await new Promise(r=>setImmediate(r));assert.equal(typeof release,'function');expire();assert.equal((await task).code,'OUTCOME_UNKNOWN');release();await new Promise(r=>setImmediate(r));assert.equal(repo.commits,0);assert.equal(Object.keys(repo.snapshot().audits).length,0);
 let authRelease;const abort=new AbortController();const before=adapter(repo,{authenticate:()=>new Promise(r=>authRelease=r)});const cancelled=before.save(request(),{signal:abort.signal});await Promise.resolve();abort.abort();assert.equal((await cancelled).code,'CANCELLED');authRelease({uid:'owner'});await Promise.resolve();assert.equal(repo.commits,0);
});
test('published status is preserved; private saves never publish or change publication metadata',async()=>{
 const repo=fakeProviderTransactions(),save=adapter(repo);await save.save(request());repo.change(s=>s.owners.owner.status='published');const publicBefore=repo.snapshot().publicViews;assert.equal((await save.save(request('next',1))).ok,true);assert.equal(repo.snapshot().owners.owner.status,'published');assert.deepEqual(repo.snapshot().publicViews,publicBefore);
});

test('missing audit receipt and malformed transaction acknowledgement fail closed without leaking driver data',async()=>{
 const repo=fakeProviderTransactions(),save=adapter(repo);await save.save(request());repo.change(s=>s.audits={});assert.equal((await save.save(request())).code,'CONFLICT');assert.equal(repo.commits,1);
 const driver=fakeProviderTransactions(),run=driver.runTransaction.bind(driver);driver.runTransaction=async(...args)=>({...await run(...args),credential:'private-driver-token'});const result=await adapter(driver).save(request());assert.equal(result.code,'OUTCOME_UNKNOWN');assert.equal(JSON.stringify(result).includes('token'),false);assert.equal(driver.commits,1);
});
