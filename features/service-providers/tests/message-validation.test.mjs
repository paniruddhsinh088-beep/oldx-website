import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../message-validation.js",import.meta.url),"utf8");
const {validateServiceChatMessage}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const context={kind:"service",providerUid:"provider",buyerUid:"buyer"};
test("buyer can prepare a trimmed text draft",()=>{
 const result=validateServiceChatMessage({text:"  Hello  ",senderUid:"buyer",context});
 assert.deepEqual(result,{ok:true,text:"Hello",senderUid:"buyer"});
});
test("provider can prepare a draft",()=>{
 assert.equal(validateServiceChatMessage({text:"Available",senderUid:"provider",context}).ok,true);
});
test("outsider cannot prepare a service chat draft",()=>{
 assert.equal(validateServiceChatMessage({text:"Hello",senderUid:"stranger",context}).ok,false);
});
test("empty or whitespace-only messages are rejected",()=>{
 for(const text of ["","  ","\n"]) assert.equal(validateServiceChatMessage({text,senderUid:"buyer",context}).ok,false);
});
test("oversized messages are rejected",()=>{
 assert.equal(validateServiceChatMessage({text:"a".repeat(2001),senderUid:"buyer",context}).ok,false);
});
test("non-text attachments are not accepted as text",()=>{
 assert.equal(validateServiceChatMessage({text:{attachment:"file"},senderUid:"buyer",context}).ok,false);
});
test("invalid context is rejected",()=>{
 for(const value of [null,{...context,kind:"product"},{...context,buyerUid:"provider"}])
  assert.equal(validateServiceChatMessage({text:"Hi",senderUid:"buyer",context:value}).ok,false);
});
test("control characters are rejected",()=>{
 assert.equal(validateServiceChatMessage({text:"Hi\u0000there",senderUid:"buyer",context}).ok,false);
});
