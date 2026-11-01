const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,updateDoc}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-typing-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-typing",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"chats/room"),{participants:["buyer","seller"],productId:"p1"});});});
test("participant may toggle only own typing state",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertSucceeds(updateDoc(doc(buyer,"chats/room"),{typing_buyer:true}));
 await assertSucceeds(updateDoc(doc(buyer,"chats/room"),{typing_buyer:false}));
});
test("typing updates cannot forge another user or mutate room ownership",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),stranger=env.authenticatedContext("stranger").firestore();
 await assertFails(updateDoc(doc(buyer,"chats/room"),{typing_seller:true}));
 await assertFails(updateDoc(doc(buyer,"chats/room"),{typing_buyer:"yes"}));
 await assertFails(updateDoc(doc(buyer,"chats/room"),{typing_buyer:true,participants:["buyer","stranger"]}));
 await assertFails(updateDoc(doc(stranger,"chats/room"),{typing_stranger:true}));
});
