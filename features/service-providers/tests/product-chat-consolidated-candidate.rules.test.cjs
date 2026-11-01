const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,updateDoc,serverTimestamp,arrayUnion}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-consolidated-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-consolidated",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"products/p1"),{sellerUid:"seller"});await setDoc(doc(c.firestore(),"chats/existing"),{participants:["buyer","seller"],productId:"p1"});await setDoc(doc(c.firestore(),"chats/existing/messages/old"),{senderUid:"buyer",text:"hello",attachment:null,status:"sent",createdAt:1});});});
test("buyer creates room; existing room supports merge, typing, timestamp",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertSucceeds(setDoc(doc(buyer,"chats/new"),{participants:["buyer","seller"],productId:"p1"}));
 await assertSucceeds(setDoc(doc(buyer,"chats/existing"),{participants:["buyer","seller"],productId:"p1"},{merge:true}));
 await assertSucceeds(setDoc(doc(buyer,"chats/existing"),{typing_buyer:true},{merge:true}));
 await assertSucceeds(setDoc(doc(buyer,"chats/existing"),{lastUpdated:serverTimestamp()},{merge:true}));
});
test("message send, receipt, self-hide and sender delete all work",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),seller=env.authenticatedContext("seller").firestore();
 await assertSucceeds(setDoc(doc(buyer,"chats/existing/messages/new"),{senderUid:"buyer",text:"hi",status:"sent",createdAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(seller,"chats/existing/messages/new")));
 await assertSucceeds(updateDoc(doc(seller,"chats/existing/messages/old"),{status:"read"}));
 await assertSucceeds(updateDoc(doc(seller,"chats/existing/messages/old"),{hiddenFor:arrayUnion("seller")}));
 await assertSucceeds(updateDoc(doc(buyer,"chats/existing/messages/old"),{deletedForEveryone:true,text:"",attachment:null}));
});
test("outsider and forgery blocked across room and messages",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),stranger=env.authenticatedContext("stranger").firestore();
 await assertFails(getDoc(doc(stranger,"chats/existing")));
 await assertFails(getDoc(doc(stranger,"chats/existing/messages/old")));
 await assertFails(setDoc(doc(stranger,"chats/existing/messages/attack"),{senderUid:"stranger",text:"hi",status:"sent",createdAt:1}));
 await assertFails(setDoc(doc(buyer,"chats/existing/messages/forged"),{senderUid:"seller",text:"hi",status:"sent",createdAt:1}));
 await assertFails(setDoc(doc(buyer,"chats/existing"),{participants:["buyer","stranger"]},{merge:true}));
});

test("service-prefixed rooms cannot inherit product chat permissions",async()=>{
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),"chats/service_fake"),{participants:["buyer","seller"],productId:"p1"});
  await setDoc(doc(c.firestore(),"chats/service_fake/messages/old"),{senderUid:"buyer",text:"hi",status:"sent",createdAt:1});
 });
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertFails(getDoc(doc(buyer,"chats/service_fake")));
 await assertFails(getDoc(doc(buyer,"chats/service_fake/messages/old")));
 await assertFails(setDoc(doc(buyer,"chats/service_fake/messages/new"),{senderUid:"buyer",text:"hi",status:"sent",createdAt:1}));
 await assertFails(setDoc(doc(buyer,"chats/service_fake"),{typing_buyer:true},{merge:true}));
 await assertFails(setDoc(doc(buyer,"chats/service_new"),{participants:["buyer","seller"],productId:"p1"}));
});

test("message creation rejects forged timestamps, non-text payloads, and oversized text",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertFails(setDoc(doc(buyer,"chats/existing/messages/forged-time"),{senderUid:"buyer",text:"hello",status:"sent",createdAt:1}));
 await assertFails(setDoc(doc(buyer,"chats/existing/messages/not-text"),{senderUid:"buyer",text:42,status:"sent",createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(buyer,"chats/existing/messages/oversized"),{senderUid:"buyer",text:"x".repeat(10001),status:"sent",createdAt:serverTimestamp()}));
});
test("unauthenticated client cannot read product room or messages",async()=>{
 const guest=env.unauthenticatedContext().firestore();
 await assertFails(getDoc(doc(guest,"chats/existing")));
 await assertFails(getDoc(doc(guest,"chats/existing/messages/old")));
});
