import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {STAGING_MARKETPLACE_COLLECTIONS as collections, STAGING_RATE_COLLECTION} from '../../scripts/staging-marketplace-context.mjs';

const load=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));

test('Phase B owner-read fixture plan is synthetic, review-only and uses native private namespaces',async()=>{
 const plan=await load('./fixtures/phase-b-owner-read-plan.json');
 const existing=await load('../firestore-emulator/fixtures.json');
 assert.equal(plan.mode,'LOCAL_PLAN_ONLY');
 assert.equal(plan.cloudWriteApproved,false);
 assert.equal(plan.runtimeActivationApproved,false);
 assert.equal(plan.projectId,'oldx-staging');
 assert.equal(plan.databaseId,'(default)');
 assert.equal(plan.productionProjectForbidden,'oldx-1c983');
 assert.equal(plan.actors.owner,existing.users.sellerA.uid);
 assert.equal(plan.actors.foreignBuyer,existing.users.buyerB.uid);
 assert.notEqual(plan.actors.owner,plan.actors.foreignBuyer);
 assert.equal(plan.proposedDocument.ownerUid,plan.actors.owner);
 assert.equal(plan.proposedDocument.collection,collections.privateRecords);
 assert.equal(plan.eligibleActorCollection,collections.actors);
 assert.equal(plan.quotaCollection,STAGING_RATE_COLLECTION);
 assert.match(plan.proposedDocument.id,/^product_synthetic-[a-z0-9-]+$/);
 assert.equal(plan.proposedDocument.data,'DESIGN_ONLY_NOT_A_FIRESTORE_WRITE_PAYLOAD');
 assert.equal(plan.httpRoute,'/api/staging/marketplace/owner');
 assert.equal(plan.httpMethod,'POST');
 assert.deepEqual(new Set(plan.scenarios.map(s=>s.name)),new Set([
  'owner-read','foreign-owner','missing-firebase-token','revoked-token',
  'foreign-project-token','disabled-runtime','rate-limit-exceeded'
 ]));
 const contents=JSON.stringify(plan);
 assert.equal(contents.includes('PRIVATE KEY'),false);
 assert.equal(contents.includes('Bearer '),false);
 assert.equal(contents.includes('@gmail.com'),false);
 assert.ok(plan.prohibited.includes('public-access-grant'));
 assert.ok(plan.prohibited.includes('production-user-data'));
});
