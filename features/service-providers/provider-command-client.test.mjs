import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderCommandClient} from './provider-command-client.mjs';
const draft = () => ({requestId:'key-1',expectedRevision:0,profile:{displayName:'Sample',services:['Plumber']}});
const success = {status:200,body:{ok:true,status:'saved',providerId:'p1',revision:1}};
const unknown = {status:202,body:{ok:false,error:{code:'OUTCOME_UNKNOWN'},retrySameRequest:true}};
test('disabled until explicitly configured and session scoped', async () => {
 let sent = 0;
 const client = createProviderCommandClient({send:()=>{sent++;return success;}});
 assert.equal((await client.submit('draft.save',draft())).code,'UNAVAILABLE');
 client.setSession('owner1');
 assert.equal((await client.submit('draft.save',draft())).code,'UNAVAILABLE');
 assert.equal(sent,0);
});
test('successful draft and publication commands return no private fields to UI state', async () => {
 const states=[], requests=[];
 const client = createProviderCommandClient({enabled:true,send:r=>{requests.push(r);return r.operation==='draft.save'?success:{status:200,body:{ok:true,status:'applied',providerId:'p1',action:'publish',generation:2}};},onChange:s=>states.push(s)});
 client.setSession('owner1');
 assert.equal((await client.submit('draft.save',draft())).ok,true);
 assert.equal((await client.submit('publication.manage',{requestId:'pub-1',expectedRevision:1,expectedGeneration:1,action:'publish'})).ok,true);
 assert.equal(requests.length,2);
 assert.deepEqual(states.at(-1),{status:'success'});
 assert.equal(JSON.stringify(states).includes('Sample'),false);
});
test('unknown response retains exact bytes and idempotency key until explicit retry', async () => {
 const sent=[], input=draft();let calls=0;
 const client=createProviderCommandClient({enabled:true,send:command=>{sent.push(command);return ++calls===1?unknown:success;}});
 client.setSession('owner1');
 assert.equal((await client.submit('draft.save',input)).code,'OUTCOME_UNKNOWN');
 input.requestId='changed';input.profile.displayName='Changed';
 assert.equal((await client.submit('draft.save',draft())).code,'PENDING_RECONCILIATION');
 assert.equal((await client.retryUnknown()).ok,true);
 assert.equal(sent[0].body,sent[1].body);
 assert.equal(JSON.parse(sent[1].body).requestId,'key-1');
 assert.equal((await client.retryUnknown()).code,'NO_UNKNOWN_OUTCOME');
});
test('network errors and invalid responses are unknown, never silently retried',async()=>{
 let calls=0;
 const client=createProviderCommandClient({enabled:true,send:()=>{calls++;throw Error('secret');}});
 client.setSession('owner1');assert.equal((await client.submit('draft.save',draft())).code,'OUTCOME_UNKNOWN');assert.equal(calls,1);
 assert.equal((await client.submit('draft.save',draft())).code,'PENDING_RECONCILIATION');assert.equal(calls,1);
});
test('session change cancels old work and cannot leak stale results or retry payload',async()=>{
 let resolve;const states=[];
 const client=createProviderCommandClient({enabled:true,send:()=>new Promise(r=>resolve=r),onChange:s=>states.push(s)});
 client.setSession('owner1');const p=client.submit('draft.save',draft());await Promise.resolve();await Promise.resolve();
 client.setSession('owner2');assert.equal((await p).code,'STALE');resolve(success);await Promise.resolve();
 assert.deepEqual(states.at(-1),{status:'idle'});assert.equal((await client.retryUnknown()).code,'NO_UNKNOWN_OUTCOME');
});
test('timeout aborts even ignored transport and preserves manual same-key retry',async()=>{
 let expire, signal;
 const client=createProviderCommandClient({enabled:true,send:(r,context)=>{signal=context.signal;return new Promise(()=>{});},schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});
 client.setSession('owner1');const p=client.submit('draft.save',draft());await Promise.resolve();expire();
 assert.equal((await p).code,'OUTCOME_UNKNOWN');assert.equal(signal.aborted,true);
});
test('rejects accessor, prototypes, extra keys, oversized and invalid payload without evaluating getters',async()=>{
 let evaluated=0,calls=0;
 const client=createProviderCommandClient({enabled:true,send:()=>{calls++;return success;}});client.setSession('owner1');
 const getter=draft();Object.defineProperty(getter.profile,'displayName',{get(){evaluated++;return 'secret';},enumerable:true});
 const invalid=[getter,{...draft(),ownerUid:'forged'},{...draft(),requestId:'bad space'},Object.assign(Object.create(null),draft()),{...draft(),profile:{displayName:'x'.repeat(17000)}},{...draft(),profile:{nested:new Date()}},{...draft(),profile:{deep:{a:{b:{c:{d:{e:{f:1}}}}}}}}];
 for(const value of invalid)assert.equal((await client.submit('draft.save',value)).code,'INVALID_REQUEST');
 assert.equal((await client.submit('publication.manage',{requestId:'pub',expectedRevision:0,expectedGeneration:-1,action:'publish'})).code,'INVALID_REQUEST');
 assert.equal(evaluated,0);assert.equal(calls,0);
});
test('HTTP authorization/conflict/rate failures do not expose backend text or permit unknown retry',async()=>{
 for(const status of [401,403,409,429,503]){
  const states=[];const client=createProviderCommandClient({enabled:true,send:()=>({status,body:{error:{code:'private-secret'}}}),onChange:s=>states.push(s)});
  client.setSession('owner1');assert.equal((await client.submit('draft.save',draft())).code,'HTTP_'+status);
  assert.equal((await client.retryUnknown()).code,'NO_UNKNOWN_OUTCOME');assert.equal(JSON.stringify(states).includes('private-secret'),false);
 }
});
test('pre-dispatch session invalidation prevents transport calls and sparse arrays fail validation',async()=>{
 let calls=0;const client=createProviderCommandClient({enabled:true,send:()=>{calls++;return success;}});
 client.setSession('owner1');const pending=client.submit('draft.save',draft());client.setSession('owner2');
 assert.equal((await pending).code,'STALE');assert.equal(calls,0);
 const sparse=draft();sparse.profile.services=Array(2);sparse.profile.services[1]='Plumber';
 assert.equal((await client.submit('draft.save',sparse)).code,'INVALID_REQUEST');assert.equal(calls,0);
});
