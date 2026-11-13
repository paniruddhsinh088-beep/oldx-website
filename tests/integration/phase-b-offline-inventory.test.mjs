import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOfflinePhaseBInventory,validateOfflinePhaseBInventory} from '../../scripts/phase-b-offline-inventory.mjs';

test('Phase B inventory binds exact synthetic users and documents only',async()=>{
 const p=await makeOfflinePhaseBInventory();
 const out=validateOfflinePhaseBInventory(p);
 assert.deepEqual(out.users,['synthetic-seller-a','synthetic-buyer-b']);
 assert.deepEqual(out.documents,[
  'marketplaceActors_v1/synthetic-seller-a',
  'marketplacePrivate_v1/product_synthetic-phase-b-read-01'
 ]);
 assert.equal(out.cloudOperationsPerformed,0);
 assert.equal(out.status,'REVIEW_ONLY');
});

test('Phase B inventory refuses permissions, mutations and foreign paths',async()=>{
 const p=await makeOfflinePhaseBInventory();
 for(const patch of [
  {projectId:'oldx-1c983'},{databaseId:'alternate'},
  {cloudExecutionApproved:true},{cleanupApproved:true},
  {users:[...p.users,{uid:'someone-else',status:'planned'}]},
  {documents:[{path:'products/live',status:'planned'},p.documents[1]]},
  {actualWrites:1},{actualDeletes:1},
  {users:p.users.map((x,i)=>i?x:{...x,status:'created'})},
  {createdAt:'2026-11-13T00:00:00Z'},
  {quotaCounterPaths:['marketplaceRateLimits_v1/unknown']},
  {runMarker:'real-person-secret'}
 ])assert.throws(()=>validateOfflinePhaseBInventory({...p,...patch}),/Invalid Phase B inventory/);
});
