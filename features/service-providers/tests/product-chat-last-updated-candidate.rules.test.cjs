const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,updateDoc,serverTimestamp}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-last-updated-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-updated",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"chats/room"),{participants:["buyer","seller"],productId:"p1"});});});
test("participant may set lastUpdated with server time",async()=>{
 await assertSucceeds(updateDoc(doc(env.authenticatedContext("buyer").firestore(),"chats/room"),{lastUpdated:serverTimestamp()}));
});
test("forged time, ownership changes and outsiders are rejected",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore();
 await assertFails(updateDoc(doc(buyer,"chats/room"),{lastUpdated:new Date("2020-01-01")}));
 await assertFails(updateDoc(doc(buyer,"chats/room"),{lastUpdated:serverTimestamp(),participants:["buyer","stranger"]}));
 await assertFails(updateDoc(doc(env.authenticatedContext("stranger").firestore(),"chats/room"),{lastUpdated:serverTimestamp()}));
});
