const {test,before,after,beforeEach}=require("node:test");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc}=require("firebase/firestore");

const root=resolve(__dirname,"..");
const base=readFileSync(resolve(root,"firestore.rules.draft"),"utf8");
const fragment=readFileSync(resolve(root,"service-chat.rules.fragment"),"utf8");
const anchor="    // Existing OLDX collection rules must be preserved when merging.";
if(!base.includes(anchor)) throw Error("Rules insertion point missing");
const rules=base.replace(anchor,fragment+"\n"+anchor);
const room="chats/service_8_provider_5_buyer";
const message=room+"/messages/message1";
let env;
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
const seed=(path,value)=>env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),path),value));
before(async()=>{env=await initializeTestEnvironment({
  projectId:"demo-oldx-service",
  firestore:{host:"127.0.0.1",port:8080,rules}
});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});
const roomData={chatType:"service",serviceProviderId:"provider",participants:["buyer","provider"]};
test("only room participants can get service chat",async()=>{
  await seed(room,roomData);
  await assertSucceeds(getDoc(doc(db("buyer"),room)));
  await assertSucceeds(getDoc(doc(db("provider"),room)));
  await assertFails(getDoc(doc(db("stranger"),room)));
  await assertFails(getDoc(doc(db(),room)));
});
test("room listing denied even for participants",async()=>{
  await seed(room,roomData);
  await assertFails(getDocs(collection(db("buyer"),"chats")));
});
test("client cannot create or forge a service room",async()=>{
  await assertFails(setDoc(doc(db("buyer"),room),roomData));
  await assertFails(setDoc(doc(db("provider"),room),roomData));
});
test("client cannot alter participants or delete service room",async()=>{
  await seed(room,roomData);
  await assertFails(updateDoc(doc(db("buyer"),room),{participants:["buyer","stranger"]}));
  await assertFails(deleteDoc(doc(db("provider"),room)));
});
test("participants can read messages; outsiders cannot",async()=>{
  await seed(room,roomData);
  await seed(message,{senderUid:"buyer",text:"Hello"});
  await assertSucceeds(getDoc(doc(db("buyer"),message)));
  await assertSucceeds(getDocs(collection(db("provider"),room+"/messages")));
  await assertFails(getDoc(doc(db("stranger"),message)));
  await assertFails(getDocs(collection(db(),room+"/messages")));
});
test("clients cannot create, change or delete service messages",async()=>{
  await seed(room,roomData);
  await seed(message,{senderUid:"buyer",text:"Hello"});
  await assertFails(setDoc(doc(db("buyer"),room+"/messages/forged"),{senderUid:"buyer",text:"Fake"}));
  await assertFails(updateDoc(doc(db("buyer"),message),{text:"changed"}));
  await assertFails(deleteDoc(doc(db("provider"),message)));
});


test("malformed participant arrays never grant room or message access",async()=>{
  for(const participants of [[],["buyer"],["buyer","provider","stranger"],"buyer"]){
    await env.clearFirestore();
    await seed(room,{chatType:"service",participants});
    await seed(message,{senderUid:"buyer",text:"private"});
    await assertFails(getDoc(doc(db("buyer"),room)));
    await assertFails(getDoc(doc(db("buyer"),message)));
  }
});
test("service fragment does not authorize legacy product rooms",async()=>{
  await seed(room,{chatType:"product",participants:["buyer","provider"]});
  await seed(message,{senderUid:"buyer",text:"legacy"});
  await assertFails(getDoc(doc(db("buyer"),room)));
  await assertFails(getDoc(doc(db("buyer"),message)));
});

test("service room with mismatched provider metadata cannot be read",async()=>{
  for(const serviceProviderId of [undefined,"stranger",42]){
    await env.clearFirestore();
    await seed(room,{chatType:"service",participants:["buyer","provider"],...(serviceProviderId === undefined ? {} : {serviceProviderId})});
    await seed(message,{senderUid:"buyer",text:"private"});
    await assertFails(getDoc(doc(db("buyer"),room)));
    await assertFails(getDoc(doc(db("provider"),message)));
  }
});

test("service room reads reject duplicate or non-string participants",async()=>{
  for(const participants of [["buyer","buyer"],["provider","provider"],["buyer",42],["buyer",null]]){
    await env.clearFirestore();
    await seed(room,{...roomData,participants});
    await seed(message,{senderUid:"buyer",text:"private"});
    await assertFails(getDoc(doc(db("buyer"),room)));
    await assertFails(getDoc(doc(db("buyer"),message)));
  }
});

test("client room creation remains disabled even with canonical participants",async()=>{
  const canonical={chatType:"service",serviceProviderId:"provider",participants:["buyer","provider"]};
  await assertFails(setDoc(doc(db("buyer"),room),canonical));
  await assertFails(setDoc(doc(db("provider"),room),canonical));
  await assertFails(setDoc(doc(db("stranger"),room),canonical));
});

test("service room updates and deletes stay denied for every role",async()=>{
  await seed(room,roomData);
  for(const uid of ["buyer","provider","stranger"]){
    await assertFails(updateDoc(doc(db(uid),room),{chatType:"service"}));
    await assertFails(deleteDoc(doc(db(uid),room)));
  }
});

test("service messages remain immutable for buyer provider and outsider",async()=>{
  await seed(room,roomData);
  await seed(message,{senderUid:"buyer",text:"Original"});
  for(const uid of ["buyer","provider","stranger"]){
    await assertFails(setDoc(doc(db(uid),room+"/messages/new-"+uid),{senderUid:uid,text:"Hello"}));
    await assertFails(updateDoc(doc(db(uid),message),{text:"Tampered"}));
    await assertFails(deleteDoc(doc(db(uid),message)));
  }
});

test("service message reads require authenticated participant even if message sender is forged",async()=>{
  await seed(room,roomData);
  await seed(message,{senderUid:"stranger",text:"Forged sender"});
  await assertSucceeds(getDoc(doc(db("buyer"),message)));
  await assertFails(getDoc(doc(db("stranger"),message)));
  await assertFails(getDoc(doc(db(),message)));
});

test("service chat never exposes messages from a non-service room",async()=>{
  for(const chatType of ["product","store",null]){
    await env.clearFirestore();
    await seed(room,{...roomData,chatType});
    await seed(message,{senderUid:"buyer",text:"private"});
    await assertFails(getDoc(doc(db("buyer"),message)));
    await assertFails(getDocs(collection(db("provider"),room+"/messages")));
  }
});
