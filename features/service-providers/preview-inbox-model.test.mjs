import test from 'node:test';import assert from 'node:assert/strict';
import {buildSampleInbox,readSampleInboxDetail,changeSampleEnquiry,SAMPLE_ENQUIRY_STATES,SAMPLE_PROVIDER_ACTIONS} from './preview-inbox-model.mjs';
import {createSampleInbox} from './preview-inbox-fixtures.mjs';
const actor={role:'provider',id:'p1'};
const request=(row,action)=>({providerId:row.providerId,id:row.id,revision:row.revision,action});
test('inbox summaries preserve provider/service separation without notes, replies or buyer IDs',()=>{
 const context=createSampleInbox('p1');assert.equal(buildSampleInbox(context,actor).items.length,8);
 const result=buildSampleInbox(context,actor,{status:'new'});assert.equal(result.items.length,1);
 assert.deepEqual(Object.keys(result.items[0]).sort(),['id','service','status','revision'].sort());
 assert.ok(buildSampleInbox(context,actor,{service:context.provider.services[0]}).items.every(r=>r.service===context.provider.services[0]));
 assert.equal(buildSampleInbox(context,{role:'provider',id:'p2'}).ok,false);
 assert.equal(buildSampleInbox({...context,records:[...context.records,createSampleInbox('p2').records[0]]},actor).ok,false);
});
test('proposed actor matrix permits only linked buyer/provider details; admin remains unapproved',()=>{
 const context=createSampleInbox('p1'),id=context.records[0].id;
 for(const [role,idActor,expected] of [['guest','guest',false],['buyer','sample-buyer-1',true],['buyer','other',false],['provider','p1',true],['provider','p2',false],['admin','admin',false]])assert.equal(readSampleInboxDetail(context,{role,id:idActor},id).ok,expected);
 for(const id of ['../private','missing','x'.repeat(101),null])assert.equal(readSampleInboxDetail(context,actor,id).ok,false);
 assert.equal(readSampleInboxDetail({...context,provider:{...context.provider,published:false}},actor,id).ok,false);
});
test('proposed provider action/state matrix is exhaustive and never grants completion or reviews',()=>{
 for(const state of SAMPLE_ENQUIRY_STATES)for(const action of [...Object.keys(SAMPLE_PROVIDER_ACTIONS),'confirm-completion']){
  const context=createSampleInbox('p1'),row=context.records.find(r=>r.status===state);
  const input={...request(row,action),...(action==='reply'?{reply:'Sample reply only'}:{})};
  const result=changeSampleEnquiry(context,actor,input);
  assert.equal(result.ok,Object.hasOwn(SAMPLE_PROVIDER_ACTIONS,action)&&SAMPLE_PROVIDER_ACTIONS[action].includes(state),`${state}/${action}`);
  if(result.ok){assert.equal(result.context.records.find(r=>r.id===row.id).revision,1);assert.equal(Object.hasOwn(result.context,'reviewEligible'),false);}
 }
});
test('only linked synthetic buyer can confirm completion; replay, stale and cross-provider changes fail',()=>{
 let context=createSampleInbox('p1');let row=context.records.find(r=>r.status==='completion-requested');
 assert.equal(changeSampleEnquiry(context,actor,request(row,'confirm-completion')).ok,false);
 const changed=changeSampleEnquiry(context,{role:'buyer',id:row.buyerId},request(row,'confirm-completion'));assert.equal(changed.ok,true);
 assert.equal(changeSampleEnquiry(changed.context,{role:'buyer',id:row.buyerId},request(row,'confirm-completion')).code,'STALE_SAMPLE');
 assert.equal(changeSampleEnquiry(context,actor,{...request(row,'cancel'),providerId:'p2'}).ok,false);
 assert.equal(changeSampleEnquiry(context,actor,{...request(row,'cancel'),reviewEligible:true}).ok,false);
});
test('local replies are bounded, private detail only, immutable and invalid on cancelled/withdrawn state',()=>{
 const context=createSampleInbox('p1'),row=context.records[0];const input={...request(row,'reply'),reply:'PRIVATE SAMPLE reply'};
 const next=changeSampleEnquiry(context,actor,input);assert.equal(next.ok,true);assert.equal(context.records[0].reply,'');
 assert.equal(JSON.stringify(buildSampleInbox(next.context,actor)).includes('PRIVATE'),false);
 const cancelled=changeSampleEnquiry(next.context,actor,{...request(next.context.records[0],'cancel')});
 assert.equal(changeSampleEnquiry(cancelled.context,actor,{...request(cancelled.context.records[0],'reply'),reply:'text'}).ok,false);
 for(const reply of ['<script>','x'.repeat(401),'bad\u0085'])assert.equal(changeSampleEnquiry(context,actor,{...input,reply}).ok,false);
});

test('malformed or withdrawn contexts and inconsistent completion flags fail closed',()=>{
 const context=createSampleInbox('p1'),row=context.records[0];
 for(const patch of [{service:'other service'},{buyerConfirmed:true},{note:'<script>'},{revision:Infinity}]){
  const records=[{...row,...patch}];assert.equal(buildSampleInbox({...context,records},actor).ok,false);
 }
 const withdrawn={...context,provider:{...context.provider,published:false}};assert.equal(changeSampleEnquiry(withdrawn,actor,request(row,'accept')).ok,false);
 const saturated={...context,records:[{...row,revision:Number.MAX_SAFE_INTEGER}]};assert.equal(changeSampleEnquiry(saturated,actor,request(saturated.records[0],'accept')).ok,false);
 assert.ok(Object.values(SAMPLE_PROVIDER_ACTIONS).every(Object.isFrozen));
});
