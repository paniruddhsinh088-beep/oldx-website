import {test} from "node:test";
import {strict as assert} from "node:assert";
import {planLegacyBlockEdges} from "../legacy-block-reconciliation.js";
import {auditBlockEdgeParity} from "../legacy-block-parity.js";
const plan=planLegacyBlockEdges([{uid:"buyer",blockedUsers:["provider"]},{uid:"provider",blockedUsers:["buyer"]}]);
const a="serviceChatBlocks/buyer/blocked/provider",b="serviceChatBlocks/provider/blocked/buyer";
test("complete migration matches both directions",()=>{
 assert.deepEqual(auditBlockEdgeParity(plan,[a,b]),{matches:true,expectedCount:2,observedCount:2,missing:[],unexpected:[]});
});
test("missing or extra block edges fail parity",()=>{
 assert.deepEqual(auditBlockEdgeParity(plan,[a]).missing,[b]);
 assert.equal(auditBlockEdgeParity(plan,[a,b,"serviceChatBlocks/other/blocked/buyer"]).matches,false);
});
test("malformed and duplicate observed edges are rejected",()=>{
 assert.throws(()=>auditBlockEdgeParity(plan,[a,a]));
 assert.throws(()=>auditBlockEdgeParity(plan,["users/buyer"]));
});
