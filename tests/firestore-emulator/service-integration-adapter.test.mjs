import test from 'node:test';import assert from 'node:assert/strict';
import {projectServiceIntegrationResponse as project} from '../../scripts/service-integration-adapter.mjs';
import {createSampleBuyerInbox} from '../../features/service-providers/preview-inbox-fixtures.mjs';
import {createSampleConversationMessages} from '../../features/service-providers/preview-conversation.mjs';
const request={kind:'enquiry',providerId:'p1',enquiryId:'p1-sample-3',expectedRevision:0},actor={role:'buyer',id:'sample-buyer-1'},options={enabled:true};
function fixture(){const context=createSampleBuyerInbox('p1');return {providerId:'p1',revision:0,published:true,context,messages:createSampleConversationMessages(context,request.enquiryId),blocks:{buyerBlocked:false,providerBlocked:false}};}
test('integration response adapter is disabled and rejects stale, foreign, unpublished or forged scope',()=>{
 const trusted=fixture();assert.equal(project(request,trusted,actor).ok,false);assert.equal(project(request,trusted,actor,options).ok,true);
 for(const r of [{...request,providerId:'p2'},{...request,expectedRevision:1},{...request,enquiryId:'p1-sample-2'},{...request,actorUid:'foreign'},{...request,kind:'admin'}])assert.equal(project(r,trusted,actor,options).ok,false);
 for(const t of [{...trusted,published:false},{...trusted,revision:1}])assert.equal(project(request,t,actor,options).ok,false);
 assert.equal(project(request,trusted,{role:'provider',id:'p2'},options).ok,false);
});
test('private enquiry/conversation DTOs are allowlisted, participant bound and require both known block facts',()=>{
 const trusted=fixture();assert.deepEqual(Object.keys(project(request,trusted,actor,options).value).sort(),['id','note','providerId','reply','service','status']);
 const r={...request,kind:'conversation'};assert.equal(project(r,trusted,actor,options).value.length,2);
 for(const blocks of [undefined,{}, {buyerBlocked:true,providerBlocked:false},{buyerBlocked:false,providerBlocked:null}])assert.equal(project(r,{...trusted,blocks},actor,options).ok,false);
 const response=project(r,trusted,actor,options);trusted.messages[0].text='changed after projection';assert.notEqual(response.value[0].text,trusted.messages[0].text);
});
test('public profile projection never includes private participant or admin fields',()=>{
 const publicProfile={id:'p1',displayName:'Sample',city:'Ahmedabad',serviceArea:'Sample locality',services:['સુથાર'],available:true,description:'Sample only',languages:['gu'],email:'private@example.invalid',ownerUid:'private-owner',adminNotes:'private'};
 const trusted={...fixture(),publicProfile};const result=project({...request,kind:'profile',enquiryId:null},trusted,null,options);assert.equal(result.ok,true);assert.equal(JSON.stringify(result).includes('private'),false);
 assert.equal(project({...request,kind:'profile',enquiryId:null},{...trusted,publicProfile:{...publicProfile,id:'p2'}},null,options).ok,false);
});
