import test from "node:test";
import assert from "node:assert/strict";
import {listServiceProfilesForModeration,moderateServiceProfile} from "../service-moderation-adapter.js";
const auth={currentUser:{uid:"admin1"}};
function fakeDb(){const calls=[];return {calls,collection(name){assert.equal(name,"serviceProviders");return {where(field,op,value){calls.push(["where",field,op,value]);return {limit(n){calls.push(["limit",n]);return {async get(){return {docs:[{id:"p1",data:()=>({displayName:"Provider",city:"Surat",serviceCategories:["plumber"],status:value,privatePhone:"hidden"})}]};}};}};},doc(id){return {async update(data){calls.push(["update",id,data]);}};}};}};}
test("admin can list pending profiles with safe projection",async()=>{
 const db=fakeDb();const rows=await listServiceProfilesForModeration({auth,db});
 assert.equal(rows.length,1);assert.equal(rows[0].status,"pending");assert.equal("privatePhone" in rows[0],false);
 assert.deepEqual(db.calls[0],["where","status","==","pending"]);
});
test("rejects unauthenticated listing and invalid statuses",async()=>{
 await assert.rejects(listServiceProfilesForModeration({auth:{},db:fakeDb()}));
 await assert.rejects(listServiceProfilesForModeration({auth,db:fakeDb(),status:"deleted"}),TypeError);
 await assert.rejects(listServiceProfilesForModeration({auth,db:fakeDb(),limit:100}),RangeError);
});
test("moderation cannot accept unsafe identifiers or statuses",async()=>{
 await assert.rejects(moderateServiceProfile({auth,db:fakeDb(),providerId:"../admins",status:"active"}),TypeError);
 await assert.rejects(moderateServiceProfile({auth,db:fakeDb(),providerId:"p1",status:"verified"}),TypeError);
});
