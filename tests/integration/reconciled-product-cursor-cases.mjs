import assert from 'node:assert/strict';import {legacyProductMutationsAcceptance} from './legacy-product-mutations-cases.mjs';import {createIsolatedProductConversationRepository} from '../../scripts/firebase-product-conversation-repository.mjs';
export async function reconciledProductCursorAcceptance(options){
 const f=await legacyProductMutationsAcceptance(options),{threadId}=f;f.session('seller');assert.equal((await f.chat.changeBlock({requestId:'adapter-unblock',threadId,expectedRevision:3,expectedBlocked:true,blocked:false})).status,'changed');await f.reconcile();
 const chat=createIsolatedProductConversationRepository({...f.base,legacyMutationsEnabled:true,reconciledHistoryEnabled:true});
 // Current source: buyer messages 1/3, seller message 2; #2 hidden for buyer, #3 deleted.
 assert.equal((await f.chat.read({threadId,expectedRevision:3,afterSequence:0,limit:20})).code,'DENIED');
 f.session('seller');f.resetOps();let page=await chat.read({threadId,expectedRevision:3,afterSequence:0,limit:2});assert.equal(page.ok,true);assert.deepEqual(f.operations(),{writes:0,messageReads:2});assert.deepEqual(page.messages.map(m=>m.sequence),[1,2]);assert.equal(page.throughSequence,2);assert.equal(page.hasMore,true);const oldProof=page.readReceipt;
 const gap=await chat.read({threadId,expectedRevision:3,afterSequence:2,limit:1});assert.deepEqual(gap.messages,[]);assert.equal(gap.throughSequence,3);assert.equal(gap.hasMore,false);assert.equal((await chat.acknowledge({threadId,readReceipt:gap.readReceipt})).code,'READ_GAP');
 f.session('buyer');assert.equal((await chat.acknowledge({threadId,readReceipt:oldProof})).code,'INVALID_READ_RECEIPT');const hidden=await chat.read({threadId,expectedRevision:3,afterSequence:1,limit:1});assert.equal(hidden.ok,true);assert.deepEqual(hidden.messages,[]);assert.equal(hidden.throughSequence,2);
 f.session('seller');f.clock(4);const send={requestId:'after-reconciled',threadId,expectedRevision:3,text:'નવી नई message'};f.resetOps();assert.equal((await chat.send(send)).status,'sent');assert.deepEqual(f.operations(),{writes:8,messageReads:1});f.resetOps();assert.equal((await chat.send(send)).status,'replayed');assert.equal(f.operations().writes,0);assert.equal((await f.page()).totalUnread,1);f.session('buyer');assert.equal((await f.page()).totalUnread,1);f.session('seller');
 let lose=true;const uncertain=createIsolatedProductConversationRepository({...f.base,reconciledHistoryEnabled:true,sdk:{...f.base.sdk,runTransaction:async(...args)=>{const r=await f.base.sdk.runTransaction(...args);if(lose&&r?.status==='advanced'){lose=false;throw Error('Lost reconciled read commit acknowledgment');}return r;}}});
 f.resetOps();assert.equal((await uncertain.acknowledge({threadId,readReceipt:oldProof})).code,'OUTCOME_UNKNOWN');assert.deepEqual(f.operations(),{writes:5,messageReads:0});f.resetOps();assert.equal((await uncertain.acknowledge({threadId,readReceipt:oldProof})).status,'unchanged');assert.deepEqual(f.operations(),{writes:0,messageReads:0});assert.equal((await f.page()).totalUnread,0);
 // Empty tombstone-only page advances the physical cursor without inventing unread.
 assert.equal((await chat.acknowledge({threadId,readReceipt:gap.readReceipt})).status,'advanced');
 f.session('buyer');const delivered=await chat.read({threadId,expectedRevision:4,afterSequence:0,limit:20});assert.equal(delivered.ok,true);assert.deepEqual(delivered.messages.map(m=>m.sequence),[1,4]);assert.equal(delivered.throughSequence,4);assert.equal(delivered.hasMore,false);assert.equal((await f.page()).totalUnread,1);
 f.session('seller');f.clock(5);assert.equal((await chat.send({...send,requestId:'newer',expectedRevision:4,text:'Unseen fifth'})).status,'sent');f.session('buyer');assert.equal((await f.page()).totalUnread,2);
 const duplicate=await Promise.all([chat.acknowledge({threadId,readReceipt:delivered.readReceipt}),chat.acknowledge({threadId,readReceipt:delivered.readReceipt})]);assert.deepEqual(duplicate.map(r=>r.status).sort(),['advanced','unchanged']);assert.equal((await f.page()).totalUnread,1);
 // Later reconciliation consumes physical cursor state and preserves the visible total.
 await f.reconcile();assert.equal((await f.page()).totalUnread,1);const finalPage=await chat.read({threadId,expectedRevision:5,afterSequence:4,limit:20});assert.deepEqual(finalPage.messages.map(m=>m.sequence),[5]);const reopened=await chat.read({threadId,expectedRevision:5,afterSequence:0,limit:20});assert.deepEqual(reopened.messages.map(m=>m.sequence),[1,4,5]);
 const ops={reads:0,writes:0,queries:0},sdk=f.base.sdk;
 const measured=createIsolatedProductConversationRepository({...f.base,reconciledHistoryEnabled:true,sdk:{
  ...sdk,
  runTransaction:(db,work,options)=>sdk.runTransaction(db,raw=>work({
   get(reference){ops[reference.path?'reads':'queries']++;return raw.get(reference);},
   set(...args){ops.writes++;return raw.set(...args);}
  }),options)
 }});
 assert.equal((await measured.acknowledge({threadId,readReceipt:reopened.readReceipt})).status,'advanced');
 assert.deepEqual(ops,{reads:12,writes:5,queries:0});
 console.log('MEASURE Product reconciled acknowledgement',ops);
 assert.equal((await chat.acknowledge({threadId,readReceipt:finalPage.readReceipt})).status,'unchanged');assert.equal((await f.page()).totalUnread,0);
 // Every privacy mutation changes the epoch: old receipts never become valid again.
 assert.equal((await chat.changeVisibility({requestId:'hide-fifth',threadId,expectedRevision:5,sequence:5,action:'hide_for_self'})).status,'changed');assert.equal((await chat.read({threadId,expectedRevision:5,afterSequence:0,limit:20})).code,'DENIED');await f.reconcile();assert.equal((await chat.acknowledge({threadId,readReceipt:finalPage.readReceipt})).code,'INVALID_READ_RECEIPT');
 f.session('foreign');assert.equal((await chat.read({threadId,expectedRevision:5,afterSequence:0,limit:20})).code,'DENIED');assert.equal((await chat.acknowledge({threadId,readReceipt:delivered.readReceipt})).code,'DENIED');

 f.session('buyer');const blocked={requestId:'reconciled-block',threadId,expectedRevision:5,expectedBlocked:false,blocked:true};assert.equal((await chat.changeBlock(blocked)).status,'changed');await f.reconcile();assert.equal((await chat.read({threadId,expectedRevision:5,afterSequence:0,limit:20})).code,'DENIED');assert.equal((await chat.acknowledge({threadId,readReceipt:finalPage.readReceipt})).code,'DENIED');assert.equal((await chat.changeBlock({...blocked,requestId:'reconciled-unblock',expectedBlocked:true,blocked:false})).status,'changed');await f.reconcile();assert.equal((await chat.acknowledge({threadId,readReceipt:finalPage.readReceipt})).code,'INVALID_READ_RECEIPT');
 const {createHash}=await import('node:crypto'),key=createHash('sha256').update(JSON.stringify([threadId,1])).digest('hex'),original=await options.get(f.c.messages,key),malformed={...original};delete malformed.readPrefix;await options.seed(f.c.messages,key,malformed);assert.equal((await chat.read({threadId,expectedRevision:5,afterSequence:0,limit:20})).code,'READ_STATE_UNAVAILABLE');await options.seed(f.c.messages,key,original);
 console.log('MEASURE reconciled adapter: reads <=20 physical messages/page, exact index deltas, send 8 writes/1 message existence read, ack 5 writes/0 message reads, replay 0 writes; epoch-fenced receipts, lost-ack and multi-device replay verified.');
 return {...f,chat};
}
