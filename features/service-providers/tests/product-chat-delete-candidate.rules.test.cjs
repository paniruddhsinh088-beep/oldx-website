const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,updateDoc,arrayUnion}=require("firebase/firestore");
const rules=readFileSync(resolve(__dirname,"fixtures/product-chat-delete-candidate.rules"),"utf8");
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-delete",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),"chats/room"),{participants:["buyer","seller"]});await setDoc(doc(c.firestore(),"chats/room/messages/old"),{senderUid:"buyer",text:"hello",attachment:"photo",status:"sent",createdAt:1});});});
test("participant can hide only for self and sender can delete for everyone",async()=>{
 const buyer=env.authenticatedContext("buyer").firestore(),seller=env.authenticatedContext("seller").firestore();
 await assertSucceeds(updateDoc(doc(seller,"chats/room/messages/old"),{hiddenFor:arrayUnion("seller")}));
 await assertSucceeds(updateDoc(doc(buyer,"chats/room/messages/old"),{deletedForEveryone:true,text:"",attachment:null}));
});
test("stranger cannot hide and recipient cannot delete for everyone",async()=>{
 const seller=env.authenticatedContext("seller").firestore(),stranger=env.authenticatedContext("stranger").firestore();
 await assertFails(updateDoc(doc(stranger,"chats/room/messages/old"),{hiddenFor:arrayUnion("stranger")}));
 await assertFails(updateDoc(doc(seller,"chats/room/messages/old"),{deletedForEveryone:true,text:"",attachment:null}));
 await assertFails(updateDoc(doc(seller,"chats/room/messages/old"),{hiddenFor:arrayUnion("buyer")}));
});
