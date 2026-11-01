const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/legacy-message-rule-overlap.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-service",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});
test("recursive legacy write allow bypasses restrictive service message match",async()=>{
 const path="chats/service_example/messages/forged";
 await assertSucceeds(setDoc(doc(env.authenticatedContext("stranger").firestore(),path),{senderUid:"buyer",text:"forged"}));
 await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),"chats/service_example/messages/guest"),{text:"guest"}));
});
