import test from 'node:test';import assert from 'node:assert/strict';
import {createSampleBuyerInbox} from './preview-inbox-fixtures.mjs';
import {buildSampleBuyerInbox,sampleBuyerActions,readSampleInboxDetail,changeSampleEnquiry} from './preview-inbox-model.mjs';
import {parseSampleBuyerRoute} from './preview-inbox-route.mjs';
const actor={role:'buyer',id:'sample-buyer-1'},context=()=>createSampleBuyerInbox('p1');
const request=(r,action)=>({providerId:r.providerId,id:r.id,revision:r.revision,action});
test('buyer lists only participant-owned summaries and strict provider/service scope',()=>{
 const c=context(),result=buildSampleBuyerInbox(c,actor);assert.equal(result.ok,true);assert.equal(result.items.length,8);
 assert.equal(result.items.some(r=>r.id==='p1-sample-2'),false);assert.equal(JSON.stringify(result).includes('Sample response'),false);
 assert.deepEqual(Object.keys(result.items[0]).sort(),['id','service','status','revision'].sort());
 for(const a of [{role:'guest',id:actor.id},{role:'provider',id:'p1'},{role:'admin',id:'admin'}])assert.equal(buildSampleBuyerInbox(c,a).ok,false);
 assert.equal(readSampleInboxDetail(c,actor,'p1-sample-2').ok,false);assert.equal(readSampleInboxDetail(c,actor,'p2-sample-1').ok,false);
 assert.equal(buildSampleBuyerInbox({...c,provider:{...c.provider,published:false}},actor).ok,false);
 assert.equal(buildSampleBuyerInbox(c,actor,{service:'forged'}).ok,false);
});
test('buyer actions use canonical cancellation/dispute/confirmation without review entitlement',()=>{
 const c=context();for(const action of ['cancel','dispute','confirm-completion']){
  const row=c.records.find(r=>sampleBuyerActions(c,actor,r.id).includes(action));assert.ok(row);
  const next=changeSampleEnquiry(c,actor,request(row,action));assert.equal(next.ok,true);
  const changed=next.context.records.find(r=>r.id===row.id);assert.equal(changed.status,action==='cancel'?'cancelled':action==='dispute'?'disputed':'completed');
  assert.equal(Object.hasOwn(changed,'reviewEligible'),false);assert.equal(changeSampleEnquiry(next.context,actor,request(row,action)).ok,false);
 }
 for(const r of c.records.filter(r=>['completed','cancelled','disputed','declined'].includes(r.status)))assert.deepEqual(sampleBuyerActions(c,actor,r.id),[]);
});
test('malformed scopes, cross-buyer/provider actions and revoked profiles return no private fields',()=>{
 const c=context(),row=c.records[0];
 for(const patch of [{providerId:'p2'},{revision:-1},{reviewEligible:true},{id:'p1-sample-2'},{id:'../secret'}])assert.equal(changeSampleEnquiry(c,actor,{...request(row,'cancel'),...patch}).ok,false);
 for(const hash of ['#buyer/../private/provider/p1','#buyer/sample-buyer-1/provider/p1?role=admin','#buyer/'+ 'x'.repeat(101)+'/provider/p1',null,{}])assert.equal(parseSampleBuyerRoute(hash),null);
 assert.deepEqual(parseSampleBuyerRoute('#buyer/sample-buyer-1/provider/p1/enquiry/p1-sample-1'),{buyerId:'sample-buyer-1',providerId:'p1',enquiryId:'p1-sample-1'});
 assert.equal(changeSampleEnquiry({...c,provider:{...c.provider,published:false}},actor,request(row,'cancel')).ok,false);
});
