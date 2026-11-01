const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,serverTimestamp}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-merge-update-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-merge-update",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"chats/room"),{participants:["buyer","seller"],productId:"p1"});});});
test("existing room accepts safe merge-set metadata updates",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertSucceeds(setDoc(doc(buyer,"chats/room"),{participants:["buyer","seller"],productId:"p1"},{merge:true}));
 await assertSucceeds(setDoc(doc(buyer,"chats/room"),{lastUpdated:serverTimestamp()},{merge:true}));
 await assertSucceeds(setDoc(doc(buyer,"chats/room"),{typing_buyer:true},{merge:true}));
});
test("merge-set cannot replace participants, product, or another user's typing",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),stranger=env.authenticatedContext("stranger").firestore();
 await assertFails(setDoc(doc(buyer,"chats/room"),{participants:["buyer","stranger"]},{merge:true}));
 await assertFails(setDoc(doc(buyer,"chats/room"),{productId:"p2"},{merge:true}));
 await assertFails(setDoc(doc(buyer,"chats/room"),{typing_seller:true},{merge:true}));
 await assertFails(setDoc(doc(stranger,"chats/room"),{lastUpdated:serverTimestamp()},{merge:true}));
});
