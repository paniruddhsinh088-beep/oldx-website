import test from 'node:test';import assert from 'node:assert/strict';import {prepareEnquiryMessageIntent} from '../../scripts/enquiry-message-intent.mjs';
const context={enquiryId:'sample-1',buyerUid:'buyer-a',providerUid:'provider-a',providerPublished:true,messagingAllowed:true,revision:2,buyerBlockedProvider:false,providerBlockedBuyer:false};
const request={enquiryId:'sample-1',expectedRevision:2,clientRequestId:'request-1',text:'Cafe\u0301 sample message'};
const plan=(c=context,r=request,actor='buyer-a')=>prepareEnquiryMessageIntent(c,r,actor,{enabled:true});
test('enquiry message intent is inactive by default and never creates product-chat IDs',()=>{
 assert.equal(prepareEnquiryMessageIntent(context,request,'buyer-a').ok,false);
 const result=plan({...context,phone:'PRIVATE',internalNotes:'PRIVATE'});assert.equal(result.ok,true);assert.equal(result.value.senderUid,'buyer-a');assert.equal(result.value.recipientUid,'provider-a');assert.equal(result.value.text,'Café sample message');
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(Object.hasOwn(result.value,'chatId'),false);assert.equal(Object.hasOwn(result.value,'productId'),false);
 assert.equal(plan(context,request,'provider-a').value.recipientUid,'buyer-a');
});
test('both block directions must be explicitly known false for either participant',()=>{
 for(const actor of ['buyer-a','provider-a'])for(const field of ['buyerBlockedProvider','providerBlockedBuyer'])for(const value of [true,undefined,null,'false',0])assert.equal(plan({...context,[field]:value},request,actor).ok,false);
});
test('forged sender/membership, stale scope, publication or unapproved messaging deny without content',()=>{
 for(const patch of [{senderUid:'attacker'},{participants:['attacker']},{role:'admin'},{enquiryId:'other'},{expectedRevision:1},{clientRequestId:'../x'},{text:'<img>'},{text:'x'.repeat(2001)}])assert.equal(plan(context,{...request,...patch}).ok,false);
 for(const patch of [{providerPublished:false},{messagingAllowed:false},{providerUid:'buyer-a'},{revision:NaN}])assert.equal(plan({...context,...patch}).ok,false);
 assert.deepEqual(plan(context,request,'outsider'),{ok:false,code:'ENQUIRY_MESSAGE_UNAVAILABLE'});
});
