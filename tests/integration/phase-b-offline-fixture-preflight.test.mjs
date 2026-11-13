import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createOfflinePreview,validatePhaseBPlan} from '../../scripts/phase-b-offline-fixture-preflight.mjs';

test('Phase B offline preview is exact-target, never executable cloud work',async()=>{
 const p=await createOfflinePreview();
 assert.equal(p.currentPermission,'PREPARATION_ONLY');
 assert.equal(p.cloudOperationsPerformed,0);
 assert.equal(p.project,'oldx-staging');
 assert.equal(p.database,'(default)');
 assert.deepEqual(p.authUsers,['synthetic-seller-a','synthetic-buyer-b']);
 assert.deepEqual(p.documentPaths,[
  'marketplaceActors_v1/synthetic-seller-a',
  'marketplacePrivate_v1/product_synthetic-phase-b-read-01'
 ]);
 assert.match(p.creation,/Separate approval required/);
 assert.match(p.cleanup,/no collection-wide deletes/);
});

test('Phase B guard fails closed on wrong target or implied permission',async()=>{
 const {readFile}=await import('node:fs/promises');
 const raw=JSON.parse(await readFile(new URL('./fixtures/phase-b-owner-read-plan.json',import.meta.url),'utf8'));
 for(const change of [
  {projectId:'oldx-1c983'},{databaseId:'another'},{cloudWriteApproved:true},
  {runtimeActivationApproved:true},{actors:{...raw.actors,owner:'real-user'}},
  {proposedDocument:{...raw.proposedDocument,id:'product_live'}},
  {eligibleActorCollection:'products'}
 ]){
  assert.throws(()=>validatePhaseBPlan({...raw,...change}),/Unsafe Phase B plan/);
 }
});

test('Phase B CLI explicitly refuses absent or write-oriented arguments',()=>{
 const file=new URL('../../scripts/phase-b-offline-fixture-preflight.mjs',import.meta.url);
 for(const args of [[],['--create'],['--cleanup'],['--verify'],['--dry-run','--create']]){
  const p=spawnSync(process.execPath,[file.pathname,...args],{encoding:'utf8',timeout:10000});
  assert.equal(p.status,2);
  assert.match(p.stderr,/Only --dry-run is supported/);
 }
});
