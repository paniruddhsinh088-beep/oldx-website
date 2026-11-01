const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/production-chat-privacy-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-privacy",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"chats/room"),{participants:["buyer","seller"],chatType:"product"});await setDoc(doc(c.firestore(),"chats/room/messages/one"),{senderUid:"buyer",text:"private"});});});
test("only participants can read room and messages",async()=>{
 for(const uid of ["buyer","seller"]){const db=env.authenticatedContext(uid).firestore();await assertSucceeds(getDoc(doc(db,"chats/room")));await assertSucceeds(getDoc(doc(db,"chats/room/messages/one")));}
 for(const uid of ["stranger",null]){const db=uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,"chats/room")));await assertFails(getDoc(doc(db,"chats/room/messages/one")));}
});
test("candidate denies all client writes until migration is verified",async()=>{
 const db=env.authenticatedContext("buyer").firestore();
 await assertFails(setDoc(doc(db,"chats/new"),{participants:["buyer","seller"]}));
 await assertFails(setDoc(doc(db,"chats/room/messages/two"),{senderUid:"buyer",text:"blocked pending audit"}));
});
