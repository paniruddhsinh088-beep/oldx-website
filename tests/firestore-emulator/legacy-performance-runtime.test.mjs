import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,updateDoc,collection,query,where,orderBy,limit,startAfter,documentId,getDocsFromServer,writeBatch,Timestamp} from 'firebase/firestore';
import {feedHarness,inboxHarness} from '../integration/legacy-performance-harness.mjs';
let env;
before(async()=>{if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.GCLOUD_PROJECT!=='demo-oldx-emulator')throw Error('Loopback demo required');env=await initializeTestEnvironment({projectId:'demo-oldx-emulator',firestore:{rules:await readFile(new URL('./deny-all.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
const productIds=Array.from({length:27},(_,i)=>'perf-product-'+String(i).padStart(2,'0'));
function reader(db,requests){return async plan=>{requests.push(plan);assert.equal(plan.options.source,'server');assert.ok(plan.limit<=50);const constraints=[...plan.where.map(v=>where(...v)),...plan.order.map(([field,direction])=>orderBy(field==='__name__'?documentId():field,direction||'asc')),...(plan.cursor?[startAfter(plan.cursor)]:[]),limit(plan.limit)];return getDocsFromServer(query(collection(db,...plan.path),...constraints));};}
test('REAL SDK cursor pages cover dated/undated Products and exact unread beyond one page with canonical IDs',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore(),batch=writeBatch(db),requests=[];
  productIds.forEach((id,i)=>batch.set(doc(db,'products',id),{title:'મૂળ हिन्दी '+i,docId:'forged',...(i===26?{}:{createdAt:new Timestamp(100-Math.floor(i/2),i%2?123456789:223456789)})}));
  batch.set(doc(db,'chats/perf-room'),{participants:['viewer','seller'],unreadCount:99999});
  let expected=0;for(let i=0;i<123;i++){const own=i%3===0,read=i%5===0;if(!own&&!read)expected++;batch.set(doc(db,'chats/perf-room/messages/m'+String(i).padStart(3,'0')),{senderUid:own?'viewer':'seller',text:'Original '+i,...(i===1?{}:{status:read?'read':'sent'}),createdAt:Timestamp.fromMillis(i*1000)});}
  await batch.commit();
  const f=feedHarness(reader(db,requests));await f.start();while(f.state().datedMore||f.state().scanMore)await f.next();const rows=Array.from(f.rows());assert.equal(rows.filter(p=>productIds.includes(p.docId)).length,27);assert.equal(new Set(rows.map(p=>p.docId)).size,rows.length);assert.ok(rows.some(p=>p.docId===productIds[26]));const dated=rows.filter(p=>productIds.includes(p.docId)&&p.createdAt);assert.equal(dated[0].docId,productIds[0]);assert.equal(dated[1].docId,productIds[1]);
  const inbox=inboxHarness(reader(db,requests));const summaries=await inbox.context.read(inbox.user);const room=summaries.find(v=>v.chat.chatRoomId==='perf-room');assert.equal(room.unreadCount,expected);assert.equal(room.latest.text,'Original 122');assert.ok(requests.some(p=>p.path.length===3&&p.cursor));
 });
});
test('REAL deny-all baseline rejects guest, owner, unrelated and forged Admin reads/receipts on performance fixtures',async()=>{
 for(const uid of [null,'viewer','other','admin']){const db=uid?env.authenticatedContext(uid,{admin:uid==='admin'}).firestore():env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,'products',productIds[0])));await assertFails(getDoc(doc(db,'chats/perf-room/messages/m001')));await assertFails(updateDoc(doc(db,'chats/perf-room/messages/m001'),{status:'read',senderUid:'forged'}));}
});
