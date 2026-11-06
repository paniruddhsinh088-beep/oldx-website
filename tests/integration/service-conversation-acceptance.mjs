import assert from 'node:assert/strict';
import {overlapFirstWrites} from './transaction-barrier.mjs';
import {providerJourneyFixture} from './provider-journey-acceptance.mjs';
import {createProviderConversationRepository,SERVICE_CONVERSATION_TEST_SCHEMA} from '../../scripts/provider-conversation-repository.mjs';
import {createProviderConversationHttp} from '../../scripts/provider-conversation-http.mjs';
export async function serviceConversationFixture({sdk,db,seed,namespace='Messages',conversationSchema=SERVICE_CONVERSATION_TEST_SCHEMA,notificationOutbox=null,inboxIndex=null}){
 let uid='journey-provider',lost=false,limited=false,overlap=false;const concurrentSdk=overlapFirstWrites(sdk,{matches:r=>overlap&&r?.status==='sent'});
 const f=await providerJourneyFixture({sdk:{...sdk,runTransaction:async(...args)=>{const result=await concurrentSdk.runTransaction(...args);if(lost&&result?.status==='sent'){lost=false;throw new Error('Private lost acknowledgement');}return result;}},db,seed,namespace,conversationSchema,notificationOutbox,inboxIndex});
 await f.owner.saveDraft({requestId:'chat-profile',expectedRevision:0,profile:f.profile});const owner=await f.owner.bootstrap({operation:null,requestId:null});await f.owner.managePublication({requestId:'chat-publish',expectedRevision:1,expectedGeneration:0,action:'publish'});
 const session=value=>{uid=value;f.uid(value);};session('journey-buyer');const created=await f.execute('enquiry.create',{requestId:'chat-enquiry',providerId:owner.providerId,expectedPublicationGeneration:1,service:'Repair',description:'Private enquiry note',timing:'flexible'});assert.equal(created.status,200);
 const conversation=createProviderConversationRepository({enabled:true,authenticate:()=>uid?{uid}:null,repository:f.enquiries});
 const http=createProviderConversationHttp({enabled:true,verifyFirebaseToken:()=>uid?{uid}:null,consumeRateLimit:()=>({allowed:!limited}),createRepository:options=>createProviderConversationRepository({...options,enabled:true,repository:f.enquiries})});
 const execute=(op,body)=>http.handle(op,{method:'POST',headers:{authorization:'Bearer isolated.test.token','content-type':'application/json'},body:JSON.stringify(body)});
 const scope={providerId:owner.providerId,enquiryId:created.body.enquiryId};
 return {...f,scope,session,conversation,chatExecute:execute,overlapSends:()=>overlap=true,loseMessageAck:()=>lost=true,limit:value=>limited=value};
}
export async function serviceConversationAcceptance(options){
 const f=await serviceConversationFixture(options),read={...f.scope,expectedRevision:null,afterSequence:0,limit:1},send={...f.scope,expectedRevision:0,expectedEnquiryRevision:0,expectedGeneration:1,requestId:'buyer-message',text:'મૂળ Cafe\u0301 हिन्दी'};
 const empty=await f.chatExecute('read',read);assert.equal(empty.status,200);assert.equal(empty.body.thread.revision,0);assert.equal(empty.body.messages.length,0);
 f.loseMessageAck();assert.equal((await f.chatExecute('send',send)).status,202);const retry=await f.chatExecute('send',send);assert.equal(retry.body.status,'replayed');assert.equal(retry.body.thread.revision,1);
 assert.equal((await f.chatExecute('send',{...send,text:'Changed replay'})).status,409);assert.equal((await f.chatExecute('send',{...send,requestId:'forged',senderUid:'journey-provider'})).status,400);
 f.session('journey-provider');if(options.forceOverlap)f.overlapSends();const reply={...send,expectedRevision:1,requestId:'provider-message',text:'જવાબ मूल हिन्दी'};const [a,b]=await Promise.all([f.chatExecute('send',reply),f.chatExecute('send',reply)]);assert.deepEqual([a.body.status,b.body.status].sort(),['replayed','sent'],JSON.stringify([a,b]));
 const first=await f.chatExecute('read',read);assert.equal(first.body.thread.role,'provider');assert.equal(first.body.messages[0].text,send.text);assert.equal(first.body.messages[0].role,'buyer');assert.equal(first.body.hasMore,true);const second=await f.chatExecute('read',{...read,expectedRevision:2,afterSequence:1});assert.equal(second.body.messages[0].role,'provider');assert.equal(second.body.messages[0].text,reply.text);assert.equal(second.body.hasMore,false);
 assert.equal((await f.chatExecute('read',{...read,expectedRevision:1})).status,409);assert.equal(JSON.stringify(first).includes('Uid'),false);f.limit(true);assert.equal((await f.chatExecute('read',read)).status,429);f.limit(false);
 f.session('journey-buyer');assert.equal((await f.chatExecute('read',read)).body.messages[0].text,send.text);assert.equal((await f.chatExecute('send',{...send,requestId:'stale'})).status,409);
 f.session('foreign');assert.equal((await f.chatExecute('read',read)).status,403);assert.equal((await f.chatExecute('send',{...reply,expectedRevision:2})).status,403);
 f.session('journey-provider');await f.owner.managePublication({requestId:'chat-withdraw',expectedRevision:1,expectedGeneration:1,action:'withdraw'});assert.equal((await f.chatExecute('read',read)).status,403);assert.equal((await f.chatExecute('send',reply)).status,403);
}
