import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../../index.html',import.meta.url),'utf8');
function harness(){
 const calls=[],status={innerText:'unchanged'},name={innerText:'Other'},page={style:{display:'flex'}};let tracks=0;
 const start=source.indexOf('function stopTypingStatus()'),end=source.indexOf('// The listener reads the latest bounded window',start);
 assert.ok(start>=0&&end>start,'typing lifecycle functions exist');
 const closeStart=source.indexOf('function closeFullChatPage()'),closeEnd=source.indexOf('function trackUserStatus(',closeStart);
 const context={document:{getElementById:id=>id==='chatUserStatus'?status:id==='fullChatPage'?page:id==='fullChatMessages'?{replaceChildren(){}}:name},window:{location:{hash:''}},history:{back(){}},console,stopLegacyChatRead(){},trackUserStatus:()=>tracks++,db:{collection:()=>({doc:room=>({onSnapshot:callback=>{const item={room,callback,stopped:0};calls.push(item);return ()=>item.stopped++;}})})}};
 runInNewContext('let activeTypingUnsubscribe=null,activeTypingGeneration=0,activeChatUnsubscribe=null,activeStatusUnsubscribe=null,legacyChatGeneration=0,legacyChatState=null,legacyReadReceiptTimer=null;'+source.slice(start,end)+source.slice(closeStart,closeEnd)+';this.watch=watchTypingStatus;this.stop=stopTypingStatus;this.close=closeFullChatPage;',context);
 return {context,calls,status,page,tracks:()=>tracks};
}
test('switching rooms unsubscribes old typing listener and ignores queued old snapshots',()=>{
 const f=harness();f.context.watch('first','other');f.context.watch('second','other');assert.equal(f.calls[0].stopped,1);
 const typing={exists:true,data:()=>({typing_other:true})};f.calls[0].callback(typing);assert.equal(f.status.innerText,'unchanged');
 f.calls[1].callback(typing);assert.match(f.status.innerText,/typing/);f.context.stop();f.status.innerText='closed';f.calls[1].callback(typing);assert.equal(f.status.innerText,'closed');assert.equal(f.calls[1].stopped,1);
});
test('close and invalid next room stop typing reads without resurrecting presence listeners',()=>{
 const f=harness();f.context.watch('first','other');f.context.close();assert.equal(f.calls[0].stopped,1);assert.equal(f.page.style.display,'none');
 f.calls[0].callback({exists:false});assert.equal(f.tracks(),0);f.context.watch('second','other');f.context.watch(null,null);assert.equal(f.calls[1].stopped,1);f.context.stop();assert.equal(f.calls[1].stopped,1);
});
test('auth changes clear typing subscription before assigning the next identity',()=>{
 const start=source.indexOf('auth.onAuthStateChanged(user => {'),assigned=source.indexOf('window.currentUser = user',start),stop=source.indexOf('stopTypingStatus();',start);assert.ok(start>=0&&stop>start&&assigned>stop);assert.ok(source.indexOf('stopLegacyChatRead();',start)<assigned);
});
