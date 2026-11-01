import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = new URL("../", import.meta.url);
const policy = readFileSync(new URL("contact-policy.js", base), "utf8");
const policyUrl = "data:text/javascript;base64," + Buffer.from(policy).toString("base64");
const adapterSource = readFileSync(new URL("oldx-contact-adapter.js", base), "utf8")
  .replace('from "./contact-policy.js"', 'from "' + policyUrl + '"');
const {resolveServiceContactPermissions,invokeServiceContact} =
  await import("data:text/javascript;base64,"+Buffer.from(adapterSource).toString("base64"));
const auth={currentUser:{uid:"buyer"}};
function fakeDb(data={},fail=false) {
  const calls=[];
  return {
    calls,
    collection(name) {
      assert.equal(name,"users");
      return {doc(uid) {calls.push(uid);return {async get(){
        if(fail) throw new Error("permission denied");
        const item=data[uid];
        return {exists:item!==undefined,data:()=>item};
      }};}};
    }
  };
}
const args={auth,providerUid:"provider",providerStatus:"active"};
test("reads both users' blocked lists",async()=>{
  const db=fakeDb({buyer:{blockedUsers:[]},provider:{blockedUsers:[]}});
  const result=await resolveServiceContactPermissions({...args,db});
  assert.deepEqual(db.calls,["buyer","provider"]);
  assert.equal(result.blockedByViewer,false);
  assert.equal(result.blockedByProvider,false);
});
test("sender block denies action",async()=>{
  const db=fakeDb({buyer:{blockedUsers:["provider"]},provider:{blockedUsers:[]}});
  let called=false;
  const result=await invokeServiceContact({...args,db,action:"chat",onAllowed:()=>{called=true;}});
  assert.equal(result.allowed,false);
  assert.equal(called,false);
});
test("recipient block denies action",async()=>{
  const db=fakeDb({buyer:{blockedUsers:[]},provider:{blockedUsers:["buyer"]}});
  const result=await invokeServiceContact({...args,db,action:"whatsapp",onAllowed:()=>{throw Error("should not call");}});
  assert.equal(result.allowed,false);
});
test("guest denied without private Firestore reads",async()=>{
  const db=fakeDb();
  const result=await invokeServiceContact({...args,auth:{currentUser:null},db,action:"chat",onAllowed:()=>{}});
  assert.equal(result.allowed,false);
  assert.equal(db.calls.length,0);
});
test("missing user document fails closed",async()=>{
  const db=fakeDb({buyer:{blockedUsers:[]}});
  const result=await invokeServiceContact({...args,db,action:"chat",onAllowed:()=>{throw Error("should not call");}});
  assert.equal(result.allowed,false);
});
test("invalid blocked list fails closed",async()=>{
  const db=fakeDb({buyer:{blockedUsers:"provider"},provider:{blockedUsers:[]}});
  const result=await invokeServiceContact({...args,db,action:"chat",onAllowed:()=>{throw Error("should not call");}});
  assert.equal(result.allowed,false);
});
test("Firestore read failure fails closed",async()=>{
  const db=fakeDb({},true);
  const result=await invokeServiceContact({...args,db,action:"chat",onAllowed:()=>{throw Error("should not call");}});
  assert.equal(result.allowed,false);
});
test("allowed contact invokes existing host callback",async()=>{
  const db=fakeDb({buyer:{blockedUsers:[]},provider:{blockedUsers:[]}});
  let count=0;
  const result=await invokeServiceContact({...args,db,action:"chat",onAllowed:()=>{count++;}});
  assert.equal(result.allowed,true);
  assert.equal(count,1);
});


test("host action errors propagate instead of appearing as permission failures",async()=>{
  const db=fakeDb({buyer:{blockedUsers:[]},provider:{blockedUsers:[]}});
  await assert.rejects(
    invokeServiceContact({...args,db,action:"chat",onAllowed:async()=>{throw new Error("Chat unavailable");}}),
    /Chat unavailable/
  );
});
test("missing contact handler is a programming error",async()=>{
  const db=fakeDb({buyer:{blockedUsers:[]},provider:{blockedUsers:[]}});
  await assert.rejects(
    invokeServiceContact({...args,db,action:"chat"}),
    TypeError
  );
});
test("invalid action is rejected before reading private data",async()=>{
  const db=fakeDb();
  await assert.rejects(
    invokeServiceContact({...args,db,action:"delete",onAllowed:()=>{}}),
    TypeError
  );
  assert.equal(db.calls.length,0);
});
