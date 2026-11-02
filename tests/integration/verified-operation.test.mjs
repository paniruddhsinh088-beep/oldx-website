import test from 'node:test';import assert from 'node:assert/strict';
import {runVerifiedOperation} from '../../scripts/verified-operation.mjs';
test('shared boundary derives UID from authentication only and never exposes credentials to operation context',async()=>{
 let called=0;const result=await runVerifiedOperation({credential:'synthetic-token',authenticate:value=>{called++;assert.equal(value,'synthetic-token');return {uid:'owner',role:'ignored'};},run:context=>{assert.equal(Object.hasOwn(context,'credential'),false);assert.equal(Object.hasOwn(context,'role'),false);return {ok:true,actor:context.actorUid};}});assert.deepEqual(result,{ok:true,actor:'owner'});assert.equal(called,1);
 let getter=0;const identity={get uid(){getter++;return 'owner';}};const denied=await runVerifiedOperation({authenticate:()=>identity,run:()=>{throw new Error('must not run');}});assert.equal(denied.code,'AUTH_REQUIRED');assert.equal(getter,0);
});
test('auth deadline settles ignored work and suppresses later operation invocation',async()=>{
 let expire,release,calls=0;const task=runVerifiedOperation({authenticate:()=>new Promise(r=>release=r),run:()=>calls++,schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});await Promise.resolve();expire();assert.equal((await task).code,'DEADLINE_EXCEEDED');release({uid:'owner'});await Promise.resolve();assert.equal(calls,0);
});
test('read failures redact errors while attempted mutations report an uncertain outcome',async()=>{
 const config={authenticate:()=>({uid:'owner'})};assert.deepEqual(await runVerifiedOperation({...config,run:()=>{throw new Error('private-token');}}),{ok:false,code:'UNAVAILABLE'});
 assert.deepEqual(await runVerifiedOperation({...config,run:context=>{context.markMutationAttempted();throw new Error('private commit error');}}),{ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true});
 const aborted=new AbortController();aborted.abort();assert.equal((await runVerifiedOperation({...config,signal:aborted.signal,run:()=>{throw new Error('must not run');}})).code,'CANCELLED');
});
