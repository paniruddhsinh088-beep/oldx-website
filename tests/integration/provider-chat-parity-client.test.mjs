import test from 'node:test';import assert from 'node:assert/strict';import {createServiceConversationIntegration} from '../../features/service-providers/conversation-integration.mjs';import {createProviderConversationHttp} from '../../scripts/provider-conversation-http.mjs';
const thread={providerId:'provider',enquiryId:'enquiry',service:'Repair',revision:21,enquiryRevision:0,generation:1,role:'buyer',canSend:true};
test('opt-in Provider empty hidden pages advance signed acknowledgment/pagination and logout clears private state',async()=>{const reads=[],acks=[],views=[],model=createServiceConversationIntegration({enabled:true,readStateEnabled:true,reconciledHistoryEnabled:true,onPrivate:v=>views.push(v),execute:(op,b)=>{if(op==='acknowledge'){acks.push(b);return {ok:true,status:'advanced',readSequence:b.readReceipt==='empty'?20:21};}reads.push(b.afterSequence);return {ok:true,thread,messages:b.afterSequence===0?[]:[{sequence:21,role:'provider',text:'મૂળ हिन्दी'}],throughSequence:b.afterSequence===0?20:21,hasMore:b.afterSequence===0,readReceipt:b.afterSequence===0?'empty':'last'};}});model.setSession({uid:'buyer',sessionId:'s'});model.select('provider','buyer');await model.detail('enquiry');assert.equal(model.snapshot().status,'ready');await model.acknowledgeVisible();assert.equal(acks[0].readReceipt,'empty');await model.nextHistory();assert.deepEqual(reads,[0,20]);assert.equal(views.at(-1).messages[0].sequence,21);await model.acknowledgeVisible();assert.equal(acks[1].readReceipt,'last');model.setSession(null);assert.equal(views.at(-1),null);});
test('Provider sparse responses need explicit gate, bounded scanned range and monotonic messages',async()=>{for(const change of [{gate:false},{throughSequence:21},{messages:[{sequence:2,role:'provider',text:'two'},{sequence:1,role:'provider',text:'one'}]},{messages:[{sequence:20,role:'provider',text:'outside'}],throughSequence:19}]){const {gate=true,...override}=change,views=[],model=createServiceConversationIntegration({enabled:true,readStateEnabled:true,reconciledHistoryEnabled:gate,onPrivate:v=>views.push(v),execute:()=>({ok:true,thread,messages:[],throughSequence:20,hasMore:true,readReceipt:'signed',...override})});model.setSession({uid:'buyer',sessionId:'s'});model.select('provider','buyer');await model.detail('enquiry');assert.equal(model.snapshot().status,'unavailable');assert.equal(views.at(-1),null);}});
test('Provider privacy HTTP commands stay default-off and contaminated acknowledgments fail closed',async()=>{const request={method:'POST',headers:{authorization:'Bearer fixture.token.only','content-type':'application/json'},body:JSON.stringify({providerId:'provider',enquiryId:'enquiry',requestId:'r',expectedRevision:1,expectedBlocked:false,blocked:true})};assert.equal((await createProviderConversationHttp({enabled:true,readStateEnabled:true}).handle('changeBlock',request)).status,404);let r=await createProviderConversationHttp({enabled:true,readStateEnabled:true,legacyMutationsEnabled:true,verifyFirebaseToken:()=>({uid:'buyer'}),consumeRateLimit:()=>({allowed:true}),createRepository:()=>({changeBlock:()=>({ok:true,status:'changed',privateIp:'must-not-leak'})})}).handle('changeBlock',request);assert.equal(r.status,503);assert.equal(JSON.stringify(r).includes('must-not-leak'),false);});

test('Provider hide clears private content, fences reload and retries the same scoped request',async()=>{
 const calls=[],views=[];let reads=0,changes=0;
 const model=createServiceConversationIntegration({enabled:true,readStateEnabled:true,reconciledHistoryEnabled:true,
  visibilityEnabled:true,makeRequestId:()=> 'hide-once',onPrivate:v=>views.push(v),onVisibilityChanged:()=>changes++,
  execute:(op,body,context)=>{
   if(op==='read'){reads++;return {ok:true,thread,messages:[{sequence:1,role:'provider',text:'Private text'}],throughSequence:20,hasMore:true,readReceipt:'signed'};}
   calls.push({op,body,session:context.session});
   return calls.length===1?{status:202,body:{ok:false,error:{code:'OUTCOME_UNKNOWN'}}}:{ok:true,status:'replayed'};
  }});
 const session={uid:'buyer',sessionId:'active'};
 model.setSession(session);model.select('provider','buyer');await model.detail('enquiry');
 await model.hideMessage(21);assert.equal(calls.length,0);
 await model.hideMessage(1);assert.equal(views.at(-1),null);assert.equal(model.snapshot().canRetry,true);
 await model.detail('enquiry');assert.equal(reads,1);
 await model.retry();
 assert.deepEqual(calls[0],{op:'changeVisibility',body:{providerId:'provider',enquiryId:'enquiry',expectedRevision:21,requestId:'hide-once',sequence:1,action:'hide_for_self'},session});
 assert.deepEqual(calls[0],calls[1]);assert.equal(changes,1);
 model.setSession(null);await model.hideMessage(1);assert.equal(calls.length,2);
});

test('Provider block-state reply cannot revive controls or history after logout',async()=>{
 let release,reads=0;
 const model=createServiceConversationIntegration({enabled:true,readStateEnabled:true,reconciledHistoryEnabled:true,blockEnabled:true,
  execute:op=>{if(op==='blockState')return new Promise(resolve=>release=resolve);reads++;throw Error('Unexpected read');}});
 model.setSession({uid:'buyer',sessionId:'scope'});model.select('provider','buyer');
 const loading=model.detail('enquiry');
 await Promise.resolve();
 model.setSession(null);release({ok:true,blocked:true,revision:21});await loading;
 assert.equal(model.snapshot().block,null);
 await model.changeBlock();assert.equal(reads,0);
});
