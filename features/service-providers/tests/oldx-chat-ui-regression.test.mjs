import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../../../index.html",import.meta.url),"utf8");
const between=(start,end)=>{
 const a=html.indexOf(start);
 assert.notEqual(a,-1,"Missing: "+start);
 const b=html.indexOf(end,a+start.length);
 assert.notEqual(b,-1,"Missing end: "+end);
 return html.slice(a,b);
};
test("legacy message sender does not write service messages",()=>{
 const sender=between("function checkScamAndSendChatMessage()","function sendChatMessageNow(");
 assert.match(sender,/activeChatRoomId\.startsWith\('service_'\)/);
 assert.ok(sender.indexOf("activeChatRoomId.startsWith('service_')") <
   sender.indexOf("sendChatMessageNow("));
});
test("direct message sender has its own service guard",()=>{
 const sender=between("function sendChatMessageNow(msg, input)","function ");
 assert.ok(sender.includes("activeChatRoomId.startsWith('service_')"));
});
test("service read receipts are not written",()=>{
 const reader=between("function loadChatMessages(chatRoomId)","function ");
 assert.match(reader,/if \(!chatRoomId\.startsWith\('service_'\)\) setTimeout/);
});
test("service typing updates are disabled",()=>{
 const typing=between("const chatInputEl =","function watchTypingStatus(");
 assert.match(typing,/if \(activeChatRoomId\.startsWith\('service_'\)\) return/);
 assert.match(typing,/activeChatRoomId === typingRoomId/);
 assert.match(typing,/window\.currentUser\?\.uid === typingUserId/);
});
test("typing listener is disposed on chat close and on room switch",()=>{
 const close=between("function closeFullChatPage()","function trackUserStatus(");
 const typing=between("function watchTypingStatus(chatRoomId","function loadChatMessages(");
 assert.match(close,/activeTypingUnsubscribe\(\)/);
 assert.match(typing,/activeTypingUnsubscribe\(\)/);
});
test("inbox recognizes service metadata without changing product fallback",()=>{
 const inbox=between("const serviceRoom = chat.chatType === 'service'","const mainRow =");
 assert.match(inbox,/chat\.serviceProviderId/);
 assert.match(inbox,/chat\.productId/);
});
