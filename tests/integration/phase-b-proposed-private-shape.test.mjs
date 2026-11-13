import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMarketplaceProfile} from '../../scripts/firebase-marketplace-repository.mjs';
import {createOfflinePreview} from '../../scripts/phase-b-offline-fixture-preflight.mjs';

const ownerUid='synthetic-seller-a';
const id='synthetic-phase-b-read-01';
const profile=Object.freeze({
 title:'Synthetic Product',
 description:'Fictional staging-only listing',
 category:'cars',
 locationLabel:'Synthetic location',
 basePrice:100,
 isSold:false,
 storeId:null,
 photos:[]
});

test('Phase B proposed private document is compatible with existing owner DTO profile validation',()=>{
 const stored={
  id,kind:'product',ownerUid,
  revision:1,archived:false,
  published:false,publicationRevision:0,
  publicProfile:null,profile
 };
 const valid=validateMarketplaceProfile('product',stored.profile);
 assert.deepEqual(valid,profile);
 assert.equal(stored.kind,'product');
 assert.equal(stored.id,id);
 assert.equal(stored.ownerUid,ownerUid);
 assert.equal(stored.revision,1);
 assert.equal(stored.published,false);
 assert.equal(stored.publicProfile,null);
});

test('Phase B draft preserves exact owner record paths without creating resources',async()=>{
 const p=await createOfflinePreview();
 assert.deepEqual(p.documentPaths,[
  'marketplaceActors_v1/'+ownerUid,
  'marketplacePrivate_v1/product_'+id
 ]);
 assert.equal(p.cloudOperationsPerformed,0);
 assert.equal(p.currentPermission,'PREPARATION_ONLY');
});

test('Phase B proposed private profile rejects unsafe or invalid values',()=>{
 for(const bad of [
  {...profile,title:'<script>alert(1)</script>'},
  {...profile,basePrice:-1},
  {...profile,storeId:'bad/id'},
  {...profile,photos:Array(7).fill('synthetic-photo-placeholder')}
 ])assert.equal(validateMarketplaceProfile('product',bad),null);
});
