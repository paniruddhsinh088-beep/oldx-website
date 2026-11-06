import test from 'node:test';
import assert from 'node:assert/strict';
import {feedHarness,inboxHarness,syntheticRead,document,part,legacySource,queryDb} from '../integration/legacy-performance-harness.mjs';
import {runInNewContext} from 'node:vm';
const dated=Array.from({length:26},(_,i)=>document('p'+String(i).padStart(2,'0'),{createdAt:{seconds:100-i,nanoseconds:0},docId:'forged',title:'Authored '+i}));
test('homepage reads fixed cursor pages, preserves descending order and includes absent timestamps without rereading prefix',async()=>{
 const requests=[],f=feedHarness(syntheticRead({products:[...dated,document('z-legacy',{title:'No date'}),document('z-null',{createdAt:null,title:'Null date'})]},requests));
 await f.start();while(f.state().datedMore||f.state().scanMore)await f.next();const rows=Array.from(f.rows());assert.equal(rows.length,28);assert.equal(new Set(rows.map(v=>v.docId)).size,28);assert.deepEqual(rows.filter(v=>v.createdAt?.seconds).map(v=>v.docId),dated.map(v=>v.id));assert.ok(rows.some(v=>v.docId==='z-legacy'));assert.equal(rows[0].docId,'p00');
 assert.ok(requests.every(v=>v.limit===12));for(const field of ['createdAt','__name__']){const calls=requests.filter(v=>v.order[0][0]===field);assert.equal(calls[0].cursor,null);assert.ok(calls.slice(1).every(v=>v.cursor));assert.equal(new Set(calls.slice(1).map(v=>v.cursor.id)).size,calls.length-1);}
});
test('offline failure retains rows/cursors and retries the same page; refresh resets and stale sessions cannot replace it',async()=>{
 const pending=[],f=feedHarness(plan=>new Promise((resolve,reject)=>pending.push({plan,resolve,reject})));const first=f.start();pending[0].resolve({docs:dated.slice(0,12)});pending[1].resolve({docs:dated.slice(0,12)});await first;const cursor=f.state().datedCursor;const failed=f.next();pending[2].reject(Error('offline'));pending[3].resolve({docs:[]});await failed;assert.equal(f.state().datedCursor,cursor);assert.equal(f.rows().length,12);
 const retry=f.next();assert.equal(pending[4].plan.cursor,cursor);pending[4].resolve({docs:dated.slice(12,24)});pending[5].resolve({docs:dated.slice(12,24)});await retry;assert.equal(f.rows().length,24);
 const old=f.next();f.window.currentUser={uid:'replacement'};const refresh=f.start();pending[8].resolve({docs:[document('current',{createdAt:{seconds:9},title:'Current'})]});pending[9].resolve({docs:[]});await refresh;pending[6].resolve({docs:dated.slice(24)});pending[7].resolve({docs:[]});await old;assert.equal(f.rows()[0].docId,'current');assert.equal(f.rows().length,1);
});
test('single-flight Product paging rejects cached/oversized pages without silently advancing',async()=>{
 const pending=[],f=feedHarness(plan=>new Promise(resolve=>pending.push({plan,resolve})));const p=f.start();await f.next();assert.equal(pending.length,2);pending[0].resolve({docs:dated.slice(0,13)});pending[1].resolve({docs:[]});await p;assert.equal(f.rows().length,0);assert.equal(f.state().datedCursor,null);
});
function inboxRecords(){const records={chats:[]};for(let i=0;i<31;i++){const id='room'+String(i).padStart(2,'0');records.chats.push(document(id,{participants:['viewer','seller'],unreadCount:9999,lastUpdated:{seconds:1}}));records['chats/'+id+'/messages']=i===0?Array.from({length:123},(_,n)=>document('m'+String(n).padStart(3,'0'),{senderUid:n%3===0?'viewer':'seller',...(n===1?{}:{status:n%5===0?'read':'sent'}),createdAt:{seconds:n},text:'Authored '+n})):[];}return records;}
test('Inbox/badge share exact bounded incoming scans, include missing statuses and do not trust supplied counts',async()=>{
 const records=inboxRecords(),requests=[],f=inboxHarness(syntheticRead(records,requests));const a=f.context.read(f.user),b=f.context.read(f.user);assert.equal(a,b);const rows=await a;const expected=records['chats/room00/messages'].filter(d=>d.data().senderUid!=='viewer'&&d.data().status!=='read').length;assert.equal(rows.length,31);assert.equal(rows[0].unreadCount,expected);assert.notEqual(expected,9999);assert.equal(rows[0].latest.text,'Authored 122');assert.ok(requests.every(v=>v.limit<=50));assert.ok(requests.filter(v=>v.path.length===1).slice(1).every(v=>v.cursor));
});
test('failed exact unread scan shows unknown rather than zero/partial count; old sessions cannot render',async()=>{
 const f=inboxHarness(async()=>{throw Error('denied');});await f.context.badge(f.user);assert.equal(f.badge.innerText,'?');assert.equal(f.badge.style.display,'inline-block');
 const pending=[],g=inboxHarness(plan=>new Promise(resolve=>pending.push({plan,resolve})));const p=g.context.badge(g.user);g.context.window.currentUser={uid:'other'};pending[0].resolve({docs:[]});await p;assert.equal(g.badge.innerText,undefined);
});
test('typing-only room updates do not restart message scans or grant caller identities',async()=>{
 const records=inboxRecords(),requests=[];let next;const f=inboxHarness(syntheticRead(records,requests),(_plan,ok)=>{next=ok;return ()=>{};});f.context.watch('viewer');next({docs:records.chats});await f.context.read(f.user);const before=requests.length;next({docs:records.chats.map(d=>document(d.id,{...d.data(),typing_seller:true}))});assert.equal(requests.length,before);
});
function chatHarness(){const container={children:[],replaceChildren(){this.children=[];},appendChild(n){this.children.push(n);}},make=()=>({children:[],dataset:{},style:{},appendChild(n){this.children.push(n);},append(...nodes){this.children.push(...nodes);},addEventListener(){},setAttribute(){},querySelectorAll(){return [];}}),timers=[],writes=[],history=[],listeners=[];
 const context={window:{currentUser:{uid:'viewer'}},document:{getElementById:id=>id==='fullChatMessages'?container:null,createElement:make},legacyReadCopy:k=>k,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},invalidateLegacyInbox(){},refreshLegacyInboxBadge(){},db:queryDb(plan=>new Promise(resolve=>history.push({plan,resolve})),(_plan,ok,error)=>{const row={ok,error,stopped:0};listeners.push(row);return ()=>row.stopped++;})};
 runInNewContext('let legacyChatGeneration=0,legacyChatState=null,legacyReadReceiptTimer=null,activeChatUnsubscribe=null;'+part('function stopLegacyChatRead()', 'function openMessageActions(')+';this.open=loadChatMessages;this.stop=stopLegacyChatRead;this.older=()=>loadOlderLegacyChat(legacyChatState);this.state=()=>legacyChatState;',context);return {context,container,timers,writes,history,listeners,doc:(id,msg)=>({id,data:()=>msg,ref:{update:async value=>{writes.push({id,value});msg.status=value.status;}}})};
}
test('receipts update only displayed incoming messages; hidden/deleted/own messages and stale timers do not write',async()=>{
 const f=chatHarness();f.context.open('room');const rows=[f.doc('incoming',{senderUid:'seller',text:'Private',status:'sent'}),f.doc('own',{senderUid:'viewer',text:'Own'}),f.doc('hidden',{senderUid:'seller',hiddenFor:['viewer']}),f.doc('deleted',{senderUid:'seller',deletedForEveryone:true})];f.listeners[0].ok({docs:rows,empty:false});f.timers.at(-1)();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.writes.map(v=>v.id),['incoming']);assert.equal(f.history.length,0);
 f.listeners[0].ok({docs:[f.doc('stale',{senderUid:'seller',text:'Late'})],empty:false});f.context.stop();f.timers.at(-1)();assert.deepEqual(f.writes.map(v=>v.id),['incoming']);
});
test('older history uses 35-document cursor windows and old listener/errors cannot overwrite a newer session',async()=>{
 const f=chatHarness();f.context.open('room');const rows=Array.from({length:35},(_,i)=>f.doc('m'+i,{senderUid:'viewer',text:'Text '+i}));f.listeners[0].ok({docs:rows,empty:false});const older=f.context.older();assert.equal(f.history[0].plan.limit,35);assert.equal(f.history[0].plan.cursor,rows[34]);f.history[0].resolve({docs:[f.doc('old',{senderUid:'viewer',text:'Older'})]});await older;assert.equal(f.listeners[0].stopped,1);assert.equal(f.container.children[0].children[0].textContent,'Older');f.listeners[0].ok({docs:rows,empty:false});assert.equal(f.container.children.length,1);f.context.open('new');f.listeners[0].error(Error('late'));assert.equal(f.container.children.length,0);
});

test('legacy page retains original document shell and essential approved feature surfaces',()=>{assert.ok(legacySource.startsWith('<!DOCTYPE html>'));for(const id of ['productGrid','storePage','fullChatPage','fullChatMessages','adTitle','adImages','storePhotoFile','headerAdminBtn'])assert.ok(legacySource.includes('id="'+id+'"'),id);assert.equal((legacySource.match(/function openInboxModal\(/g)||[]).length,1);});

test('acknowledged stock/edit/delete updates survive further cursor loads without resurrecting a deleted record',async()=>{
 const f=feedHarness(syntheticRead({products:dated}));await f.start();f.ack('p00',{isSold:true,title:'Edited'});f.ack('p01',null);await f.next();assert.equal(f.rows().find(v=>v.docId==='p00').isSold,true);assert.equal(f.rows().find(v=>v.docId==='p00').title,'Edited');assert.equal(f.rows().some(v=>v.docId==='p01'),false);assert.equal(f.rows().filter(v=>v.docId==='p00').length,1);
});

test('denied/synchronously failing receipts are attempted once per viewed window, never in an automatic retry loop',async()=>{
 const f=chatHarness();let attempts=0;const row=f.doc('denied',{senderUid:'seller',text:'Visible',status:'sent'});row.ref.update=()=>{attempts++;throw Error('denied');};f.context.open('room');f.listeners[0].ok({docs:[row],empty:false});f.timers.at(-1)();await new Promise(resolve=>setImmediate(resolve));f.listeners[0].ok({docs:[row],empty:false});assert.equal(attempts,1);assert.equal(f.timers.length,1);
});

test('malformed SDK document identity cannot produce a successful zero unread count',async()=>{const f=inboxHarness(async()=>({docs:[{data:()=>({participants:['viewer','seller']})}]}));await f.context.badge(f.user);assert.equal(f.badge.innerText,'?');});
