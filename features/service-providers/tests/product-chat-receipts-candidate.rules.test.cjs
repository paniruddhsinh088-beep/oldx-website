const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,updateDoc,getDoc}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-receipts-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-receipts",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"chats/room"),{participants:["buyer","seller"]});await setDoc(doc(c.firestore(),"chats/room/messages/old"),{senderUid:"buyer",text:"hello",status:"sent",createdAt:1});});});
test("participant can create own message and receiver can mark read",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),seller=env.authenticatedContext("seller").firestore();
 await assertSucceeds(setDoc(doc(buyer,"chats/room/messages/new"),{senderUid:"buyer",text:"hello",status:"sent",createdAt:2}));
 await assertSucceeds(updateDoc(doc(seller,"chats/room/messages/old"),{status:"read"}));
 await assertSucceeds(getDoc(doc(seller,"chats/room/messages/new")));
});
test("strangers, sender forgery and unauthorized edits fail",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),stranger=env.authenticatedContext("stranger").firestore();
 await assertFails(setDoc(doc(stranger,"chats/room/messages/stranger"),{senderUid:"stranger",text:"bad",status:"sent",createdAt:2}));
 await assertFails(setDoc(doc(buyer,"chats/room/messages/forged"),{senderUid:"seller",text:"bad",status:"sent",createdAt:2}));
 await assertFails(updateDoc(doc(buyer,"chats/room/messages/old"),{status:"read"}));
 await assertFails(updateDoc(doc(env.authenticatedContext("seller").firestore(),"chats/room/messages/old"),{text:"tampered"}));
});

test("receipt update cannot alter sender, timestamp, or message body",async()=>{
 const seller=env.authenticatedContext("seller").firestore();
 await assertFails(updateDoc(doc(seller,"chats/room/messages/old"),{status:"read",senderUid:"seller"}));
 await assertFails(updateDoc(doc(seller,"chats/room/messages/old"),{status:"read",createdAt:999}));
 await assertFails(updateDoc(doc(seller,"chats/room/messages/old"),{status:"read",text:"edited"}));
 await assertFails(updateDoc(doc(seller,"chats/room/messages/old"),{status:"sent"}));
});
test("message creation requires a sender and valid initial status",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertFails(setDoc(doc(buyer,"chats/room/messages/no-sender"),{text:"hi",status:"sent",createdAt:2}));
 await assertFails(setDoc(doc(buyer,"chats/room/messages/read-on-create"),{senderUid:"buyer",text:"hi",status:"read",createdAt:2}));
});
