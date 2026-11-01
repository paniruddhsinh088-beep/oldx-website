const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,deleteDoc,updateDoc,serverTimestamp}=require("firebase/firestore");
const root=resolve(__dirname,"..");
const base=readFileSync(resolve(root,"firestore.rules.draft"),"utf8");
const fragment=readFileSync(resolve(root,"service-chat-block-edges.rules.fragment"),"utf8");
const anchor="    // Existing OLDX collection rules must be preserved when merging.";
if(!base.includes(anchor)) throw Error("Rules insertion point missing");
const rules=base.replace(anchor,fragment+"\n"+anchor);
let env;
const path="serviceChatBlocks/buyer/blocked/provider";
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:"demo-oldx-service",firestore:{host:"127.0.0.1",port:8080,rules}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});
test("blocker can create and read their own block edge",async()=>{
 await assertSucceeds(setDoc(doc(db("buyer"),path),{createdAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(db("buyer"),path)));
});
test("outsider and blocked party cannot read or forge block edge",async()=>{
 await assertFails(setDoc(doc(db("provider"),path),{createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db(),path),{createdAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(db("buyer"),path),{createdAt:serverTimestamp()}));
 await assertFails(getDoc(doc(db("provider"),path)));
 await assertFails(getDoc(doc(db(),path)));
});
test("blocker can remove block but nobody else can",async()=>{
 await assertSucceeds(setDoc(doc(db("buyer"),path),{createdAt:serverTimestamp()}));
 await assertFails(deleteDoc(doc(db("provider"),path)));
 await assertSucceeds(deleteDoc(doc(db("buyer"),path)));
});
test("updates and self-blocks are denied",async()=>{
 await assertSucceeds(setDoc(doc(db("buyer"),path),{createdAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db("buyer"),path),{createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db("buyer"),"serviceChatBlocks/buyer/blocked/buyer"),{createdAt:serverTimestamp()}));
});
