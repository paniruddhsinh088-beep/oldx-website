import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTORS, PUBLIC_DETAIL_CASES, DENIED_SURFACE_CASES, publicationSequence } from './testing/publication-fixtures.mjs';
import { planSyntheticDetailRead, projectSyntheticDetail } from './preview-detail.mjs';
import { projectDraftPublicCataloguePage } from './public-data-contract.mjs';
import { sampleListings } from './preview-fixtures.mjs';

for (const entry of PUBLIC_DETAIL_CASES) {
  test(`proposed public-detail matrix: ${entry.actor}, ${entry.change}`, () => {
    const scenario = publicationSequence(entry.change);
    // Actor metadata is deliberately NOT passed as authority to the projection.
    const result = projectSyntheticDetail(scenario.after, scenario.scope);
    assert.equal(result?.status ?? 'invalid', entry.expected);
    if (result?.status === 'ready') {
      assert.deepEqual(Object.keys(result.product).sort(), ['id','title','category','price','priceLabel','available'].sort());
      assert.deepEqual(Object.keys(result.store).sort(), ['id','name','city','description'].sort());
    } else assert.equal(Object.hasOwn(result ?? {}, 'product'), false);
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  });
}

test('all proposed roles are denied private/admin/legacy selectors on the public-detail contract', () => {
  for (const entry of DENIED_SURFACE_CASES) {
    assert.equal(entry.expected, 'deny');
    assert.equal(planSyntheticDetailRead({ ...publicationSequence().scope, surface: entry.surface }).ok, false);
    assert.equal(planSyntheticDetailRead({ ...publicationSequence().scope, role: entry.actor }).ok, false);
  }
  assert.deepEqual(new Set(DENIED_SURFACE_CASES.map(row=>row.actor)),new Set(ACTORS));
  // These rejections validate the public request schema, not actual backend or
  // Rules authorization. Moderator/private endpoints require separate approval.
});

test('catalogue page and cursor never authorize stale detail links after publication changes', () => {
  const records=[sampleListings[12],sampleListings[11]].map(r=>({...r,publicationStatus:'published'}));
  const first=projectDraftPublicCataloguePage({storeUid:'demo-shop',records,pageSize:1});
  assert.equal(first.ok,true); assert.equal(first.hasMore,true);
  const second=projectDraftPublicCataloguePage({storeUid:'demo-shop',records:[records[1]],pageSize:1,cursor:first.nextCursor});
  assert.equal(second.ok,true); assert.equal(second.items[0].id,'sample-12');
  const scenario=publicationSequence(); scenario.scope.productId='sample-12'; scenario.after.listing={...records[1],publicationStatus:'suspended'};
  assert.deepEqual(projectSyntheticDetail(scenario.after,scenario.scope),{status:'unavailable'});
  scenario.after.listing=null;
  assert.deepEqual(projectSyntheticDetail(scenario.after,scenario.scope),{status:'unavailable'});
  // Neither a previously listed ID nor a signed/scoped future cursor substitutes
  // for an independent fresh Store/listing detail read.
  assert.equal(planSyntheticDetailRead({...scenario.scope,cursor:first.nextCursor}).ok,false);
});

test('cross-document DTO alone cannot prove freshness; Store revalidation must reject intervening suspension', () => {
  const scenario=publicationSequence('store-suspended');
  const mixed={...scenario.after,store:scenario.before.store};
  assert.equal(projectSyntheticDetail(mixed,scenario.scope).status,'ready',
    'documents with old published flags cannot reveal a later mutation by themselves');
  assert.deepEqual(projectSyntheticDetail(scenario.after,scenario.scope),{status:'unavailable'});
  assert.deepEqual(scenario.timeline,['catalogue','Store read','publication change','listing read','Store revalidation']);
});

test('malformed identifiers and mismatched seller/product responses cannot be repaired by role claims', () => {
  for(const actor of ACTORS) {
    const scenario=publicationSequence('seller-mismatch');
    assert.equal(projectSyntheticDetail(scenario.after,scenario.scope),null);
    for(const productId of ['../private','%2Fsecret','','x'.repeat(129),null]) {
      assert.equal(planSyntheticDetailRead({...scenario.scope,productId}).ok,false);
      assert.equal(planSyntheticDetailRead({...scenario.scope,productId,role:actor}).ok,false);
    }
    scenario.after.listing={...scenario.before.listing,id:'other-product'};
    assert.equal(projectSyntheticDetail(scenario.after,scenario.scope),null);
  }
});
