const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/legacy-message-type-guard.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-service",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,"chats/product_room"),{chatType:"product"});await setDoc(doc(db,"chats/service_room"),{chatType:"service"});});});
test("product messages by sender allowed; service and forged sender denied",async()=>{
 const db=env.authenticatedContext("buyer").firestore();
 await assertSucceeds(setDoc(doc(db,"chats/product_room/messages/one"),{senderUid:"buyer",text:"hi"}));
 await assertFails(setDoc(doc(db,"chats/product_room/messages/forged"),{senderUid:"seller",text:"forged"}));
 await assertFails(setDoc(doc(db,"chats/service_room/messages/one"),{senderUid:"buyer",text:"not yet"}));
 await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),"chats/product_room/messages/guest"),{senderUid:"buyer"}));
});
