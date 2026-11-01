const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,serverTimestamp}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-room-create-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-room-create",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"products/p1"),{sellerUid:"seller"});});});
test("buyer may create valid product chat room",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertSucceeds(setDoc(doc(buyer,"chats/good"),{participants:["buyer","seller"],productId:"p1",lastUpdated:serverTimestamp()}));
});
test("invalid membership and missing product are rejected",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),seller=env.authenticatedContext("seller").firestore();
 await assertFails(setDoc(doc(buyer,"chats/no-buyer"),{participants:["seller","other"],productId:"p1"}));
 await assertFails(setDoc(doc(buyer,"chats/duplicates"),{participants:["buyer","buyer"],productId:"p1"}));
 await assertFails(setDoc(doc(buyer,"chats/wrong-seller"),{participants:["buyer","other"],productId:"p1"}));
 await assertFails(setDoc(doc(buyer,"chats/no-product"),{participants:["buyer","seller"],productId:"missing"}));
 await assertFails(setDoc(doc(seller,"chats/seller-created"),{participants:["buyer","seller"],productId:"p1"}));
});
