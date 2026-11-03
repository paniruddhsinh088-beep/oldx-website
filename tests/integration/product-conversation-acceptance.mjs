import assert from 'node:assert/strict';
import {createProductConversationHttp} from '../../scripts/product-conversation-http.mjs';
import {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA} from '../../scripts/firebase-marketplace-repository.mjs';
import {createIsolatedProductConversationRepository,PRODUCT_CONVERSATION_TEST_SCHEMA as c,productConversationBlockKey} from '../../scripts/firebase-product-conversation-repository.mjs';
// Separate namespace: preceding Emulator cases intentionally leave withdrawn rows.
const m=Object.freeze(Object.fromEntries(Object.keys(MARKETPLACE_TEST_SCHEMA).map(k=>[k,'testOldxProductJourney'+k[0].toUpperCase()+k.slice(1)])));
export async function productConversationAcceptance({sdk,db,seed,get}){
 let uid='journey-seller';const authenticate=()=>uid?{uid}:null;
 await seed(m.actors,uid,{uid,canWrite:true,canPublish:true,suspended:false});await seed(m.generations,'current',{value:0});
 for(const id of ['journey-seller','journey-buyer','journey-foreign'])await seed(c.actors,id,{uid:id,canInteract:true,suspended:false});
 for(const [a,b] of [['journey-buyer','journey-seller'],['journey-seller','journey-buyer']])await seed(c.blocks,productConversationBlockKey(a,b),{blockerUid:a,blockedUid:b,blocked:false});
 const cursors=new Map();let count=0;const market=createIsolatedMarketplaceRepository({enabled:true,firestore:db,sdk,schema:m,authenticate,allocateId:()=> 'journey-product',issueCursor:v=>{const k='cursor-'+(++count);cursors.set(k,v);return k;},readCursor:k=>cursors.get(k)});
 const profile={title:'નમૂનો नमूना Product',description:'Seller-authored text',category:'cars',locationLabel:'Ahmedabad',basePrice:120,isSold:false,storeId:null,photos:[]};
 assert.equal((await market.save('product',{requestId:'draft',id:null,expectedRevision:0,publication:'draft',profile})).ok,true);
 assert.equal((await market.save('product',{requestId:'publish',id:'journey-product',expectedRevision:1,publication:'publish',profile})).ok,true);
 uid='journey-buyer';const discovered=await market.list({kind:'product',limit:5,category:'cars',storeId:null,cursor:null});assert.equal(discovered.ok,true);assert.equal(discovered.items[0].id,'journey-product');assert.equal(JSON.stringify(discovered).includes('ownerUid'),false);
 const chat=createIsolatedProductConversationRepository({enabled:true,firestore:db,sdk,schema:c,marketplaceSchema:m,authenticate}),request={requestId:'enquire',productId:discovered.items[0].id,expectedProductRevision:2,text:'શું ઉપલબ્ધ છે? उपलब्ध है? Available?'};
 uid=null;assert.equal((await chat.open(request)).code,'AUTH_REQUIRED');uid='journey-buyer';
 assert.equal((await chat.open({...request,ownerUid:'journey-buyer'})).code,'INVALID_REQUEST');
 const http=createProductConversationHttp({enabled:true,verifyFirebaseToken:(_token,options)=>{assert.equal(options.checkRevoked,true);return authenticate();},consumeRateLimit:()=>({allowed:true}),createRepository:options=>createIsolatedProductConversationRepository({enabled:true,firestore:db,sdk,schema:c,marketplaceSchema:m,...options})});
 const wire=body=>({method:'POST',headers:{authorization:'Bearer isolated.test.token','content-type':'application/json'},body:JSON.stringify(body)});
 const outcomes=await Promise.all([http.handle('open',wire(request)),http.handle('open',wire(request))]).then(results=>results.map(r=>{assert.equal(r.status,200);assert.match(r.headers['Cache-Control'],/no-store/);return r.body;}));assert.equal(outcomes.filter(v=>v.status==='sent').length,1);assert.equal(outcomes.filter(v=>v.status==='replayed').length,1);const id=outcomes[0].thread.id;
 assert.equal((await chat.open({...request,text:'Changed replay'})).code,'IDEMPOTENCY_CONFLICT');
 uid='journey-seller';const inbox=await chat.inbox({role:'seller',limit:10});assert.equal(inbox.ok,true);assert.equal(inbox.items[0].id,id);assert.equal(JSON.stringify(inbox).includes(request.text),false);
 const read={threadId:id,expectedRevision:1,afterSequence:0,limit:1};assert.equal((await chat.read(read)).messages[0].text,request.text);
 const send={threadId:id,requestId:'reply',expectedRevision:1,text:'હા, ઉપલબ્ધ છે. हाँ। Yes.'};assert.equal((await http.handle('send',wire(send))).body.status,'sent');assert.equal((await chat.send(send)).status,'replayed');assert.equal((await chat.send({...send,requestId:'stale'})).code,'REVISION_CONFLICT');
 assert.equal((await chat.read(read)).code,'REVISION_CONFLICT');uid='journey-buyer';const history=await chat.read({...read,expectedRevision:2});assert.equal(history.hasMore,true);assert.equal((await chat.read({...read,expectedRevision:2,afterSequence:1})).messages[0].senderRole,'seller');assert.equal(JSON.stringify(history).includes('Uid'),false);
 uid='journey-foreign';assert.equal((await chat.read({...read,expectedRevision:2})).code,'DENIED');assert.equal((await chat.send({...send,requestId:'foreign',expectedRevision:2})).code,'DENIED');assert.deepEqual((await chat.inbox({role:'seller',limit:10})).items,[]);
 uid='journey-buyer';await seed(c.blocks,productConversationBlockKey('journey-seller',uid),{blockerUid:'journey-seller',blockedUid:uid,blocked:true});assert.equal((await chat.read({...read,expectedRevision:2})).code,'DENIED');assert.equal((await chat.open(request)).code,'DENIED');await seed(c.blocks,productConversationBlockKey('journey-seller',uid),{blockerUid:'journey-seller',blockedUid:uid,blocked:false});
 const controller=new AbortController();controller.abort();assert.equal((await chat.send({...send,requestId:'cancelled',expectedRevision:2},{signal:controller.signal})).code,'CANCELLED');assert.equal((await get(c.threads,id)).revision,2);
 let loseAck=true;const uncertain=createIsolatedProductConversationRepository({enabled:true,firestore:db,sdk:{...sdk,runTransaction:async(...args)=>{const result=await sdk.runTransaction(...args);if(loseAck&&result?.status==='sent'){loseAck=false;throw new Error('private transport detail');}return result;}},schema:c,marketplaceSchema:m,authenticate});
 const retry={...send,requestId:'lost-ack',expectedRevision:2,text:'Retry without duplication'};assert.equal((await uncertain.send(retry)).code,'OUTCOME_UNKNOWN');assert.equal((await uncertain.send(retry)).status,'replayed');assert.equal((await get(c.threads,id)).revision,3);
 uid='journey-seller';assert.equal((await market.save('product',{requestId:'withdraw',id:'journey-product',expectedRevision:2,publication:'withdraw',profile})).ok,true);uid='journey-buyer';assert.equal((await chat.read({...read,expectedRevision:2})).code,'DENIED');assert.equal((await chat.open(request)).code,'DENIED');assert.equal((await chat.send({...send,requestId:'withdrawn',expectedRevision:2})).code,'DENIED');assert.equal((await get(c.threads,id)).revision,3);
}
