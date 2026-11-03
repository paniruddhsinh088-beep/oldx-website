import test from 'node:test';import assert from 'node:assert/strict';import {overlapFirstWrites} from './transaction-barrier.mjs';
test('first write callbacks overlap deterministically; retry callbacks are not gated or masked',async()=>{
 for(let n=0;n<10;n++){const stages=[];const sdk=overlapFirstWrites({runTransaction:async(_db,callback)=>{const r=await callback({});assert.equal(stages.length>=2,true);return r;}});const create=()=>sdk.runTransaction(null,async()=>{stages.push('staged');return {status:'created'};});await Promise.all([create(),create()]);assert.deepEqual(await sdk.runTransaction(null,async()=>({status:'replayed'})),{status:'replayed'});}
});
