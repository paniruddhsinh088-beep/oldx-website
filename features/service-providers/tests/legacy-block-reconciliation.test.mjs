import {test} from "node:test";
import {strict as assert} from "node:assert";
import {planLegacyBlockEdges} from "../legacy-block-reconciliation.js";
test("plans canonical edges for both block directions",()=>{
 const p=planLegacyBlockEdges([{uid:"buyer",blockedUsers:["provider","provider"]},{uid:"provider",blockedUsers:["buyer"]}]);
 assert.equal(p.owners,2);assert.equal(p.edgeCount,2);
 assert.deepEqual(p.edges.map(x=>x.path),["serviceChatBlocks/buyer/blocked/provider","serviceChatBlocks/provider/blocked/buyer"]);
});
test("rejects incomplete or duplicate legacy owners",()=>{
 assert.throws(()=>planLegacyBlockEdges([{uid:"buyer"}]));
 assert.throws(()=>planLegacyBlockEdges([{uid:"buyer",blockedUsers:[]},{uid:"buyer",blockedUsers:[]}]));
 assert.throws(()=>planLegacyBlockEdges(null));
});
test("planning does not modify the input or write to Firestore",()=>{
 const users=[{uid:"buyer",blockedUsers:["provider"]}];
 const before=JSON.stringify(users);
 const p=planLegacyBlockEdges(users);
 assert.equal(JSON.stringify(users),before);
 assert.equal(Object.isFrozen(p.edges),true);
});
