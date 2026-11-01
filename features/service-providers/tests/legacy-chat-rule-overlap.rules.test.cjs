const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/legacy-chat-rule-overlap.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-service",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});
test("legacy broad allow bypasses a separate service-chat deny",async()=>{
 await assertSucceeds(setDoc(doc(env.authenticatedContext("buyer").firestore(),"chats/service_example"),{chatType:"service",participants:["buyer","provider"]}));
 await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),"chats/service_guest"),{chatType:"service"}));
});
