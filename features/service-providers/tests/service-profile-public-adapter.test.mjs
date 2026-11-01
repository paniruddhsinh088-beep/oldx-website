import test from "node:test";
import assert from "node:assert/strict";
import { getActiveServiceProfile } from "../firestore-adapter.js";
const fakeDb = record => ({collection(name) {
 assert.equal(name,"serviceProviders");
 return {doc(id) {return {async get(){return {id,exists:record!==null,data:()=>record};}};}};
}});
test("approved service profile is publicly projected without private fields", async()=>{
 const profile=await getActiveServiceProfile({db:fakeDb({status:"active",displayName:"Test",city:"Surat",district:"Surat",serviceCategories:["plumber"],ownerUid:"secret",privatePhone:"123"}),providerId:"provider1"});
 assert.equal(profile.displayName,"Test");
 assert.equal(profile.id,"provider1");
 assert.equal("privatePhone" in profile,false);
 assert.equal("ownerUid" in profile,false);
});
test("pending, suspended and missing profiles are not public",async()=>{
 for(const record of [{status:"pending"},{status:"suspended"},null]) {
  assert.equal(await getActiveServiceProfile({db:fakeDb(record),providerId:"provider1"}),null);
 }
});
test("rejects invalid provider identifiers",async()=>{
 await assert.rejects(getActiveServiceProfile({db:fakeDb(null),providerId:"../users"}),TypeError);
});
