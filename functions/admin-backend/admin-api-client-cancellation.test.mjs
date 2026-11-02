import test from 'node:test';import assert from 'node:assert/strict';import {createAdminApiClient} from './admin-api-client.mjs';
const ok=data=>({ok:true,status:200,json:async()=>({ok:true,data})});
test('pre-aborted Admin read does not acquire credentials or call the network',async()=>{
 const abort=new AbortController();abort.abort();let tokens=0,calls=0;
 const client=createAdminApiClient({getIdToken:async()=>{tokens++;return 'token';},fetchImpl:async()=>{calls++;return ok({});}});
 await assert.rejects(client.request('users.list',{}, {signal:abort.signal}),e=>e.code==='REQUEST_CANCELLED');assert.equal(tokens,0);assert.equal(calls,0);
});
test('Admin cancellation during token acquisition settles promptly and cannot start a late fetch',async()=>{
 let release,calls=0;const abort=new AbortController();
 const client=createAdminApiClient({getIdToken:()=>new Promise(resolve=>{release=resolve;}),fetchImpl:async()=>{calls++;return ok({});}});
 const task=client.request('users.list',{}, {signal:abort.signal});const outcome=task.then(()=> 'resolved',e=>e.code);abort.abort();
 assert.equal(await Promise.race([outcome,new Promise(resolve=>setImmediate(()=>resolve('pending')))]),'REQUEST_CANCELLED');
 release('late-token');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
});
test('Admin cancellation covers delayed response bodies without exposing late private payloads',async()=>{
 let release;const abort=new AbortController();let supplied;
 const client=createAdminApiClient({getIdToken:async()=> 'token',fetchImpl:async(url,options)=>{supplied=options.signal;return {ok:true,status:200,json:()=>new Promise(resolve=>{release=resolve;})};}});
 const task=client.request('users.list',{}, {signal:abort.signal});const outcome=task.then(()=> 'resolved',e=>e.code);
 while(!release)await Promise.resolve();abort.abort();
 assert.equal(await Promise.race([outcome,new Promise(resolve=>setImmediate(()=>resolve('pending')))]),'REQUEST_CANCELLED');
 assert.equal(supplied.aborted,true);release({ok:true,data:{private:'PRIVATE'}});await Promise.resolve();
});
test('Admin deadline aborts stalled fetch and releases timers; retry uses a fresh token',async()=>{
 let tick,cleared=0,calls=0,tokens=0,signal;
 const client=createAdminApiClient({timeoutMs:100,schedule:callback=>{tick=callback;return 1;},cancel:()=>cleared++,getIdToken:async()=>{tokens++;return 'token';},fetchImpl:async(url,options)=>{calls++;signal=options.signal;return calls===1?new Promise(()=>{}):ok({items:[]});}});
 const slow=client.request('users.list');const outcome=slow.then(()=> 'resolved',e=>e.code);while(calls===0)await Promise.resolve();
 assert.equal(typeof tick,'function');tick();assert.equal(await outcome,'REQUEST_TIMEOUT');assert.equal(signal.aborted,true);assert.equal(cleared,1);
 assert.deepEqual(await client.request('users.list'),{items:[]});assert.equal(tokens,2);assert.equal(cleared,2);
});
test('Admin invalid cancellation/deadline configuration fails closed and token errors are sanitized',async()=>{
 for(const timeoutMs of [0,-1,30001,Infinity,'100'])assert.throws(()=>createAdminApiClient({getIdToken:async()=> 'token',fetchImpl:async()=>ok({}),timeoutMs}),TypeError);
 const client=createAdminApiClient({getIdToken:async()=>{throw Error('PRIVATE TOKEN ERROR');},fetchImpl:async()=>ok({})});
 await assert.rejects(client.request('users.list'),e=>e.code==='AUTH_REQUIRED'&&!e.message.includes('PRIVATE'));
});

test('Admin request options and inherited operation names cannot bypass fixed client boundaries',async()=>{
 let calls=0;const client=createAdminApiClient({getIdToken:async()=>{calls++;return 'token';},fetchImpl:async()=>ok({})});
 for(const options of [null,[],{signal:{}},{timeoutMs:999999}])await assert.rejects(client.request('users.list',{},options),e=>e.code==='INVALID_REQUEST_OPTIONS');
 for(const operation of ['__proto__','constructor','toString'])await assert.rejects(client.request(operation),e=>e.code==='UNSUPPORTED_OPERATION');
 assert.equal(calls,0);
});
