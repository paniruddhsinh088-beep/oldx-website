import test from 'node:test';import assert from 'node:assert/strict';
import {createSampleBuyerInbox} from './preview-inbox-fixtures.mjs';
import {readSampleConversation,inspectSampleConversationDraft,createSampleConversationMessages,parseSampleConversationRoute} from './preview-conversation.mjs';
import {normalizeMessageDraft} from '../chat/message-text.mjs';
const actor={role:'buyer',id:'sample-buyer-1'};
function fixture(id='p1-sample-3'){const c=createSampleBuyerInbox('p1');return {c,s:{providerId:'p1',enquiryId:id,revision:0},m:createSampleConversationMessages(c,id)};}
test('buyer and provider see identical bounded projected history, no private metadata',()=>{
 const {c,s,m}=fixture();m[0].privateEmail='never project';const buyer=readSampleConversation(c,actor,s,m),provider=readSampleConversation(c,{role:'provider',id:'p1'},s,m);assert.deepEqual(buyer,provider);assert.equal(buyer.ok,true);assert.deepEqual(Object.keys(buyer.items[0]).sort(),['id','order','role','text']);assert.equal(buyer.canDraft,true);
});
test('conversation rejects foreign scope, stale revision, withdrawal, block uncertainty and malformed histories',()=>{
 const {c,s,m}=fixture();for(const [a,scope,msg,blocks] of [[{role:'buyer',id:'foreign'},s,m,{}],[{role:'provider',id:'p2'},s,m,{}],[actor,{...s,providerId:'p2'},m,{}],[actor,{...s,revision:1},m,{}],[actor,s,m,{buyerBlocked:true}],[actor,s,m,{providerBlocked:null}],[actor,s,[...m,m[0]],{}],[actor,s,[{...m[0],authorId:'foreign'}],{}],[actor,s,[{...m[0],service:'unknown'}],{}],[actor,s,Array(36).fill(m[0]),{}],[actor,s,[{...m[0],text:'<script>bad</script>'}],{}]])assert.equal(readSampleConversation(c,a,scope,msg,blocks).ok,false);
 c.provider.published=false;assert.equal(readSampleConversation(c,actor,s,m).ok,false);
});
test('draft schema matches messaging intent; closed states read history but cannot draft',()=>{
 const {c,s,m}=fixture();for(const text of ['', ' ', '<img>', '\u0000', 'x'.repeat(2001), null])assert.equal(inspectSampleConversationDraft(c,actor,s,m,{},text).ok,false);
 assert.equal(normalizeMessageDraft('\u0344'.repeat(1500)),null);
 assert.equal(normalizeMessageDraft('  e\u0301 ગુજરાતી हिन्दी  '),'é ગુજરાતી हिन्दी');assert.equal(inspectSampleConversationDraft(c,actor,s,m,{},' hello ').text,'hello');assert.equal(m.length,2);
 const closed=fixture('p1-sample-6');assert.equal(readSampleConversation(closed.c,actor,closed.s,closed.m).canDraft,false);assert.equal(inspectSampleConversationDraft(closed.c,actor,closed.s,closed.m,{},'hello').ok,false);
 for(const hash of ['#conversation/admin/p1/a','#conversation/buyer/p1/%2F','#conversation/buyer/p1/a?text=secret'])assert.equal(parseSampleConversationRoute(hash),null);
});
