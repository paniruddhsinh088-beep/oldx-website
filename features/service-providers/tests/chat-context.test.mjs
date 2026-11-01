import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../chat-context.js",import.meta.url),"utf8");
const {buildServiceChatContext,buildServiceChatCreateData}=await import(
  "data:text/javascript;base64,"+Buffer.from(source).toString("base64")
);
const input={providerUid:"provider_1",buyerUid:"buyer_1"};
test("service chat ID is deterministic",()=>{
  const a=buildServiceChatContext(input);
  const b=buildServiceChatContext(input);
  assert.equal(a.roomId,b.roomId);
  assert.equal(a.kind,"service");
});
test("different buyers have different rooms",()=>{
  assert.notEqual(buildServiceChatContext(input).roomId,
    buildServiceChatContext({...input,buyerUid:"buyer_2"}).roomId);
});
test("length prefix prevents delimiter collisions",()=>{
  assert.notEqual(buildServiceChatContext({providerUid:"a_b",buyerUid:"c"}).roomId,
    buildServiceChatContext({providerUid:"a",buyerUid:"b_c"}).roomId);
});
test("product room ID convention is not reused",()=>{
  assert.ok(buildServiceChatContext(input).roomId.startsWith("service_"));
});
test("self contact is rejected",()=>{
  assert.throws(()=>buildServiceChatContext({providerUid:"x",buyerUid:"x"}),TypeError);
});
test("invalid Firebase document IDs are rejected",()=>{
  for(const value of ["","a/b","a.b","has space",null]){
    assert.throws(()=>buildServiceChatContext({providerUid:value,buyerUid:"buyer"}),TypeError);
  }
});
test("chat creation metadata uses canonical participants",()=>{
  const context=buildServiceChatContext(input);
  const forged={...context,participants:["intruder","provider_1"]};
  const data=buildServiceChatCreateData(forged);
  assert.deepEqual(data.participants,["buyer_1","provider_1"]);
  assert.equal(data.chatType,"service");
  assert.equal(data.serviceProviderId,"provider_1");
  assert.equal("productId" in data,false);
});
test("forged room IDs are rejected",()=>{
  const context=buildServiceChatContext(input);
  assert.throws(()=>buildServiceChatCreateData({...context,roomId:"other"}),TypeError);
});
