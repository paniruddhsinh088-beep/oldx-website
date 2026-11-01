import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../",import.meta.url);
const source=name=>readFileSync(new URL(name,base),"utf8");
const asUrl=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const policyUrl=asUrl(source("contact-policy.js"));
const adapterUrl=asUrl(source("oldx-contact-adapter.js").replace(
  'from "./contact-policy.js"', 'from "'+policyUrl+'"'
));
const contextUrl=asUrl(source("chat-context.js"));
const bridge=source("oldx-chat-bridge.js")
  .replace('from "./chat-context.js"','from "'+contextUrl+'"')
  .replace('from "./oldx-contact-adapter.js"','from "'+adapterUrl+'"');
const {openVerifiedServiceChat}=await import(asUrl(bridge));
function dbWithBlocks(buyerBlocks=[],providerBlocks=[],status="active"){
  return {collection(name){return {doc(uid){return {async get(){
    if(name==="serviceProviders") return {
      exists:true,data:()=>({ownerUid:uid,status})
    };
    return {exists:true,data:()=>({blockedUsers:uid==="buyer"?buyerBlocks:providerBlocks})};
  }};}};}};
}
const auth={currentUser:{uid:"buyer"}};
test("approved buyer receives canonical service chat context",async()=>{
  let opened;
  const result=await openVerifiedServiceChat({
    auth,db:dbWithBlocks(),providerUid:"provider",
    openExistingChat:context=>{opened=context;}
  });
  assert.equal(result.allowed,true);
  assert.equal(opened.roomId,"service_8_provider_5_buyer");
  assert.deepEqual([...opened.participants],["buyer","provider"]);
});
test("provider block prevents opening chat",async()=>{
  let called=false;
  const result=await openVerifiedServiceChat({
    auth,db:dbWithBlocks([],["buyer"]),providerUid:"provider",
    openExistingChat:()=>{called=true;}
  });
  assert.equal(result.allowed,false);
  assert.equal(result.context,null);
  assert.equal(called,false);
});
test("inactive provider prevents opening chat",async()=>{
  let called=false;
  const result=await openVerifiedServiceChat({
    auth,db:dbWithBlocks([],[],"pending"),providerUid:"provider",
    openExistingChat:()=>{called=true;}
  });
  assert.equal(result.allowed,false);
  assert.equal(called,false);
});
test("guest receives login-required result without opening chat",async()=>{
  let called=false;
  const result=await openVerifiedServiceChat({
    auth:{currentUser:null},db:dbWithBlocks(),providerUid:"provider",
    openExistingChat:()=>{called=true;}
  });
  assert.equal(result.allowed,false);
  assert.match(result.reason,/sign in/i);
  assert.equal(result.context,null);
  assert.equal(called,false);
});
test("host chat opener must be supplied",async()=>{
  await assert.rejects(openVerifiedServiceChat({
    auth,db:dbWithBlocks(),providerUid:"provider",providerStatus:"active"
  }),TypeError);
});

test("caller cannot force inactive provider to active",async()=>{
 let called=false;
 const result=await openVerifiedServiceChat({
   auth,db:dbWithBlocks([],[],"suspended"),providerUid:"provider",
   providerStatus:"active",openExistingChat:()=>{called=true;}
 });
 assert.equal(result.allowed,false);
 assert.equal(called,false);
});

test("sign-out during provider lookup never opens chat",async()=>{
 const session={currentUser:{uid:"buyer"}};
 let called=false;
 const db={collection(name){return {doc(uid){return {async get(){
   if(name==="serviceProviders"){
     session.currentUser=null;
     return {exists:true,data:()=>({ownerUid:uid,status:"active"})};
   }
   return {exists:true,data:()=>({blockedUsers:[]})};
 }};}};}};
 const result=await openVerifiedServiceChat({
   auth:session,db,providerUid:"provider",openExistingChat:()=>{called=true;}
 });
 assert.equal(result.allowed,false);
 assert.equal(result.context,null);
 assert.equal(called,false);
});
test("provider document read failure denies chat",async()=>{
 let called=false;
 const db={collection(){return {doc(){return {async get(){throw Error("denied");}};}};}};
 const result=await openVerifiedServiceChat({
   auth,db,providerUid:"provider",openExistingChat:()=>{called=true;}
 });
 assert.equal(result.allowed,false);
 assert.equal(result.context,null);
 assert.equal(called,false);
});

test("provider document owned by a different user denies chat",async()=>{
 let called=false;
 const db={collection(name){return {doc(uid){return {async get(){
   if(name==="serviceProviders") return {
     exists:true,data:()=>({ownerUid:"someone_else",status:"active"})
   };
   return {exists:true,data:()=>({blockedUsers:[]})};
 }};}};}};
 const result=await openVerifiedServiceChat({
   auth,db,providerUid:"provider",openExistingChat:()=>{called=true;}
 });
 assert.equal(result.allowed,false);
 assert.equal(called,false);
});
test("buyer blocking provider denies chat",async()=>{
 let called=false;
 const result=await openVerifiedServiceChat({
   auth,db:dbWithBlocks(["provider"]),providerUid:"provider",
   openExistingChat:()=>{called=true;}
 });
 assert.equal(result.allowed,false);
 assert.equal(called,false);
});
