import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSampleProviderInbox, rehearseSampleEnquiryTransition} from './preview-inbox.mjs';
const provider = {id: 'p1', published: true, services: ['સુથાર', 'ફર્નિચર રિપેર']};
const row = (patch = {}) => ({requestId: 'sample_1', providerId: 'p1', service: 'સુથાર',
  summary: 'નમૂનાનું ખુરશી રિપેર કામ', timing: 'flexible', status: 'new', createdOrder: 3, ...patch});

test('strict provider-scoped inbox projects only sample-safe fields', () => {
  const secret = row({buyerUid: 'private-uid', phone: 'PRIVATE', address: 'PRIVATE',
    internalNotes: 'PRIVATE', moderation: 'PRIVATE', reviewEligible: true});
  const result = inspectSampleProviderInbox(provider, [secret, row({requestId: 'sample_2', providerId: 'p2'})]);
  assert.equal(result.ok, true);
  assert.equal(result.value.total, 1);
  assert.deepEqual(Object.keys(result.value.items[0]).sort(),
    ['requestId', 'providerId', 'service', 'summary', 'timing', 'status', 'createdOrder'].sort());
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(result).includes('private-uid'), false);
  assert.equal(result.value.sampleOnly, true);
});

test('scoped filters, deterministic ordering, bounded results and counts', () => {
  const rows = [row({requestId:'sample_2', createdOrder:2, status:'accepted'}),
    row({requestId:'sample_3', createdOrder:4, status:'cancelled'}), row()];
  assert.deepEqual(inspectSampleProviderInbox(provider, rows, {filter:'active'}).value.items.map(x=>x.requestId), ['sample_1','sample_2']);
  assert.equal(inspectSampleProviderInbox(provider, rows, {filter:'closed'}).value.total, 1);
  const limited = inspectSampleProviderInbox(provider, rows, {limit:1}).value;
  assert.deepEqual(limited.items.map(x=>x.requestId), ['sample_3']);
  assert.equal(limited.hasMore, true);
  assert.equal(inspectSampleProviderInbox(provider, rows, {filter:'new'}).value.total, 1);
});

test('withdrawn provider, malformed inputs and duplicate IDs fail closed', () => {
  assert.deepEqual(inspectSampleProviderInbox({...provider, published:false}, [row()]), {ok:false,code:'PROVIDER_UNAVAILABLE'});
  for (const rows of [null, Array(51).fill(row()), [row(), row()], [row({service:'Other'})],
    [row({summary:'<img src=x>'})], [row({createdOrder:-1})], [row({status:'admin'})]])
    assert.equal(inspectSampleProviderInbox(provider, rows).ok, false);
  for (const options of [{filter:'private'}, {limit:0}, {limit:21}, {limit:1.5}])
    assert.deepEqual(inspectSampleProviderInbox(provider,[row()],options),{ok:false,code:'INVALID_REQUEST'});
});

test('valid provider and buyer rehearsal transitions without trusted role claims', () => {
  const accepted = rehearseSampleEnquiryTransition(provider,row(),{actor:'provider',nextStatus:'accepted'});
  assert.equal(accepted.ok,true);
  assert.equal(accepted.value.status,'accepted');
  assert.equal(accepted.sampleOnly,true);
  assert.equal(row().status,'new');
  const progress = rehearseSampleEnquiryTransition(provider,accepted.value,{actor:'provider',nextStatus:'in_progress'});
  const requested = rehearseSampleEnquiryTransition(provider,progress.value,{actor:'provider',nextStatus:'completion_requested'});
  assert.equal(rehearseSampleEnquiryTransition(provider,requested.value,{actor:'buyer',nextStatus:'completed_confirmed'}).ok,true);
  assert.equal(rehearseSampleEnquiryTransition(provider,requested.value,{actor:'buyer',nextStatus:'disputed'}).ok,true);
  assert.equal(rehearseSampleEnquiryTransition(provider,row(),{actor:'buyer',nextStatus:'cancelled'}).ok,true);
  assert.equal(rehearseSampleEnquiryTransition(provider,row(),{actor:'provider',nextStatus:'declined'}).ok,true);
});

test('forged actors, skipped/terminal transitions and mismatched providers denied', () => {
  for (const transition of [
    {actor:'provider',nextStatus:'completed_confirmed'},
    {actor:'buyer',nextStatus:'accepted'},
    {actor:'admin',nextStatus:'accepted'},
    {actor:'provider',nextStatus:'new'},
    {actor:'provider',nextStatus:'not-real'}])
    assert.equal(rehearseSampleEnquiryTransition(provider,row(),transition).ok,false);
  assert.equal(rehearseSampleEnquiryTransition(provider,row({status:'declined'}),{actor:'provider',nextStatus:'accepted'}).ok,false);
  assert.equal(rehearseSampleEnquiryTransition(provider,row({status:'completed_confirmed'}),{actor:'buyer',nextStatus:'new'}).ok,false);
  assert.equal(rehearseSampleEnquiryTransition({...provider,id:'p2'},row(),{actor:'provider',nextStatus:'accepted'}).ok,false);
  assert.equal(rehearseSampleEnquiryTransition({...provider,published:false},row(),{actor:'provider',nextStatus:'accepted'}).ok,false);
});

test('Unicode notes remain authored, but no review entitlement or private fields propagate', () => {
  const sample = row({summary:'Cafe\u0301 नमूना કામ',reviewEligible:true,privateMessage:'PRIVATE'});
  const changed = rehearseSampleEnquiryTransition(provider,sample,{actor:'provider',nextStatus:'accepted'});
  assert.equal(changed.value.summary,'Café नमूना કામ');
  assert.equal(Object.hasOwn(changed.value,'reviewEligible'),false);
  assert.equal(JSON.stringify(changed).includes('PRIVATE'),false);
});
