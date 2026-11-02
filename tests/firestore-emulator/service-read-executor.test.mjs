import test from 'node:test';import assert from 'node:assert/strict';
import {createServiceReadExecutor} from '../../scripts/service-read-executor.mjs';
import {createSampleBuyerInbox} from '../../features/service-providers/preview-inbox-fixtures.mjs';
const request={kind:'enquiry',providerId:'p1',enquiryId:'p1-sample-3',expectedRevision:0};
const trusted=()=>({providerId:'p1',revision:0,published:true,context:createSampleBuyerInbox('p1')});
test('executor defaults off and invalid requests never reach authentication or storage',async()=>{
 let calls=0;const deps={authenticate:()=>{calls++;},readSnapshot:()=>{calls++;}};assert.equal((await createServiceReadExecutor(deps).execute(request)).status,'unavailable');
 const executor=createServiceReadExecutor({...deps,enabled:true});assert.equal((await executor.execute({...request,actorUid:'forged'})).status,'unavailable');assert.equal(calls,0);
});
test('verified actor is derived by injected authentication and only projected DTO is returned',async()=>{
 const events=[];const executor=createServiceReadExecutor({enabled:true,authenticate:(token)=>{assert.equal(token,'synthetic-token');events.push('auth');return {role:'buyer',id:'sample-buyer-1',privateClaim:'never return'};},readSnapshot:(scope,{actor})=>{events.push('read');assert.deepEqual(actor,{role:'buyer',id:'sample-buyer-1'});assert.ok(Object.isFrozen(actor));assert.equal(scope.providerId,'p1');return trusted();}});
 const result=await executor.execute(request,{credential:'synthetic-token'});assert.equal(result.status,'ready');assert.deepEqual(events,['auth','read']);assert.equal(JSON.stringify(result).includes('privateClaim'),false);assert.equal(JSON.stringify(result).includes('synthetic-token'),false);
});
test('authentication failures, foreign participants, revoked snapshots and deadlines fail closed',async()=>{
 const readSnapshot=()=>trusted();let readCalls=0;
 const badAuth=createServiceReadExecutor({enabled:true,authenticate:()=>{throw new Error('private credential');},readSnapshot:()=>readCalls++});const denied=await badAuth.execute(request);assert.equal(denied.status,'error');assert.equal(JSON.stringify(denied).includes('credential'),false);assert.equal(readCalls,0);
 const foreign=createServiceReadExecutor({enabled:true,authenticate:()=>({role:'buyer',id:'foreign'}),readSnapshot});assert.equal((await foreign.execute(request)).status,'unavailable');
 const revoked=createServiceReadExecutor({enabled:true,authenticate:()=>({role:'provider',id:'p1'}),readSnapshot:()=>({...trusted(),published:false})});assert.equal((await revoked.execute(request)).status,'unavailable');
 let expire;const timeout=createServiceReadExecutor({enabled:true,authenticate:()=>new Promise(()=>{}),readSnapshot,schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});const task=timeout.execute(request);await Promise.resolve();expire();assert.equal((await task).code,'READ_TIMEOUT');
});
test('caller cancellation settles ignored authentication and prevents a later snapshot read',async()=>{
 let resolve,calls=0;const controller=new AbortController();const executor=createServiceReadExecutor({enabled:true,authenticate:()=>new Promise(r=>resolve=r),readSnapshot:()=>{calls++;return trusted();}});
 const task=executor.execute(request,{credential:'sample',signal:controller.signal});await Promise.resolve();controller.abort();assert.equal((await task).status,'cancelled');resolve({role:'buyer',id:'sample-buyer-1'});await Promise.resolve();await Promise.resolve();assert.equal(calls,0);
});

test('accessor requests are rejected without getter evaluation and guest profiles remain public-only',async()=>{
 let getterCalls=0,readCalls=0;const malformed={...request};Object.defineProperty(malformed,'providerId',{enumerable:true,get(){getterCalls++;return 'p1';}});
 const executor=createServiceReadExecutor({enabled:true,readSnapshot:()=>{readCalls++;return trusted();}});assert.equal((await executor.execute(malformed)).status,'unavailable');assert.equal(getterCalls,0);assert.equal(readCalls,0);
 const profile={id:'p1',displayName:'Sample',city:'Sample city',serviceArea:'Sample area',services:['સુથાર'],available:true};
 const publicRead=createServiceReadExecutor({enabled:true,authenticate:()=>{throw new Error('guest must not authenticate');},readSnapshot:(r,{actor})=>{assert.equal(actor,null);return {...trusted(),publicProfile:{...profile,privateEmail:'never expose'}};}});
 const result=await publicRead.execute({...request,kind:'profile',enquiryId:null});assert.equal(result.status,'ready');assert.equal(JSON.stringify(result).includes('privateEmail'),false);
});
