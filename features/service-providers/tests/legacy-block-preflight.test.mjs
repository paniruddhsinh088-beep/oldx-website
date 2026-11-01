import {test} from "node:test";
import {strict as assert} from "node:assert";
import {inspectLegacyBlocks,checkLegacyBlockPair,canOpenServiceChatFromLegacy} from "../legacy-block-preflight.js";
test("deduplicates legacy block edges without writing data",()=>{
 assert.deepEqual(inspectLegacyBlocks("buyer",["provider","provider","other"]),[
  {blockerUid:"buyer",blockedUid:"provider"},{blockerUid:"buyer",blockedUid:"other"}]);
});
test("detects either direction of an existing block",()=>{
 assert.deepEqual(checkLegacyBlockPair({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:["provider"],providerBlockedUsers:[]}),{blockedByBuyer:true,blockedByProvider:false});
 assert.deepEqual(checkLegacyBlockPair({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:[],providerBlockedUsers:["buyer"]}),{blockedByBuyer:false,blockedByProvider:true});
});
test("rejects malformed, self-block and missing legacy lists",()=>{
 for(const list of [null,undefined,"provider",["buyer"],[42],["bad/id"]]){
  assert.throws(()=>inspectLegacyBlocks("buyer",list));
 }
 assert.throws(()=>checkLegacyBlockPair({buyerUid:"buyer",providerUid:"buyer",buyerBlockedUsers:[],providerBlockedUsers:[]}));
});

test("mutual block is reported in both directions",()=>{
 assert.deepEqual(checkLegacyBlockPair({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:["provider"],providerBlockedUsers:["buyer"]}),{blockedByBuyer:true,blockedByProvider:true});
});
test("unrelated blocks do not prevent a clean pair",()=>{
 assert.deepEqual(checkLegacyBlockPair({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:["other"],providerBlockedUsers:["third"]}),{blockedByBuyer:false,blockedByProvider:false});
});

test("fail-closed preflight rejects missing legacy data",()=>{
 assert.deepEqual(canOpenServiceChatFromLegacy({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:[]}),{allowed:false,reason:"unverified-legacy-blocks"});
 assert.deepEqual(canOpenServiceChatFromLegacy({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:[],providerBlockedUsers:["buyer"]}),{allowed:false,reason:"blocked"});
 assert.deepEqual(canOpenServiceChatFromLegacy({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:[],providerBlockedUsers:[]}),{allowed:true,reason:"clear"});
});

test("preflight rejects malformed lists even when the other side is clear",()=>{
 assert.deepEqual(canOpenServiceChatFromLegacy({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:[],providerBlockedUsers:null}),{allowed:false,reason:"unverified-legacy-blocks"});
 assert.deepEqual(canOpenServiceChatFromLegacy({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:["buyer"],providerBlockedUsers:[]}),{allowed:false,reason:"unverified-legacy-blocks"});
});
test("preflight is deterministic and does not mutate legacy lists",()=>{
 const buyer=["other","provider","provider"];
 const provider=["third"];
 const beforeBuyer=[...buyer],beforeProvider=[...provider];
 const result=canOpenServiceChatFromLegacy({buyerUid:"buyer",providerUid:"provider",buyerBlockedUsers:buyer,providerBlockedUsers:provider});
 assert.deepEqual(result,{allowed:false,reason:"blocked"});
 assert.deepEqual(buyer,beforeBuyer);
 assert.deepEqual(provider,beforeProvider);
});
