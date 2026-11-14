import test from 'node:test';
import assert from 'node:assert/strict';
import {planCleanup, EXACT_UIDS, EXACT_DOCS} from '../../scripts/phase-b-offline-cleanup-guard.mjs';

function fixture() {
 const targets=[...EXACT_UIDS.map(id=>({type:'auth',id})),...EXACT_DOCS.map(id=>({type:'firestore',id}))];
 return {
  inventory:targets.map(x=>({...x,sessionId:'synthetic-run-1',createdByThisRun:true,creationTime:'2026-11-13T18:00:00Z',
   createTime:'2026-11-13T18:00:00Z',marker:'synthetic-run-1',updateTime:'2026-11-13T18:01:00Z'})),
  observations:targets.map(x=>({...x,sessionId:'synthetic-run-1',exists:true,creationTime:'2026-11-13T18:00:00Z',
   createTime:'2026-11-13T18:00:00Z',marker:'synthetic-run-1',updateTime:'2026-11-13T18:01:00Z',exactUid:x.id}))
 };
}
test('only the four exact authorized targets produce descriptions, never executable calls',()=>{
 const v=fixture();const actions=planCleanup(v);
 assert.equal(actions.length,4);
 assert.equal(actions.filter(x=>x.type==='firestore'&&x.precondition.currentDocument.updateTime).length,2);
 assert.equal(actions.filter(x=>x.type==='auth').length,2);
 assert.ok(actions.every(x=>x.operation.endsWith('REQUIRES_OPERATOR_APPROVAL')));
});
test('unexpected or missing inventory fails closed',()=>{
 const v=fixture();v.inventory[0].id='unrelated-user';assert.throws(()=>planCleanup(v),/STOP/);
});
test('session mismatch fails closed',()=>{
 const v=fixture();v.observations[1].sessionId='different';assert.throws(()=>planCleanup(v),/STOP/);
});
test('Auth creation time or exact UID change fails closed',()=>{
 const v=fixture();v.observations[0].creationTime='other';assert.throws(()=>planCleanup(v),/STOP/);
 const w=fixture();w.observations[0].exactUid='foreign-uid';assert.throws(()=>planCleanup(w),/STOP/);
});
test('Firestore provenance marker or updateTime missing fails closed',()=>{
 const v=fixture();v.observations[2].marker='wrong';assert.throws(()=>planCleanup(v),/STOP/);
 const w=fixture();w.observations[3].updateTime='';assert.throws(()=>planCleanup(w),/STOP/);
});
test('missing target or unexpected changes fail closed',()=>{
 const v=fixture();v.observations[3].exists=false;assert.throws(()=>planCleanup(v),/STOP/);
 const w=fixture();w.observations[0].hasUnexpectedChanges=true;assert.throws(()=>planCleanup(w),/STOP/);
});
