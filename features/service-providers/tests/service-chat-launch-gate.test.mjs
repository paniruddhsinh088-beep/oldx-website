import {test} from "node:test";
import {strict as assert} from "node:assert";
import {evaluateServiceChatLaunch as gate} from "../service-chat-launch-gate.js";
const migration={legacyRecords:[{uid:"buyer",blockedUsers:["provider"]},{uid:"provider",blockedUsers:[]}],observedEdgePaths:["serviceChatBlocks/buyer/blocked/provider"],legacySnapshotComplete:true,edgeSnapshotComplete:true};
test("service chat launch fails closed without all gates",()=>{
 assert.equal(gate().enabled,false);
 assert.equal(gate({migration}).reason,"deployed-rules-source-not-verified");
 assert.equal(gate({migration,deployedRulesSourceVerified:true}).reason,"legacy-chat-rules-not-audited");
 assert.equal(gate({migration,deployedRulesSourceVerified:true,legacyChatRulesAudited:true}).reason,"server-block-rules-not-verified");
 assert.equal(gate({migration,deployedRulesSourceVerified:true,legacyChatRulesAudited:true,serverBlockRulesVerified:true}).reason,"client-write-rules-not-verified");
});
test("launch preflight only passes with all explicit proofs",()=>{
 assert.deepEqual(gate({migration,deployedRulesSourceVerified:true,legacyChatRulesAudited:true,serverBlockRulesVerified:true,clientWriteRulesVerified:true}),{enabled:true,reason:"preflight-passed"});
 assert.equal(gate({migration:{...migration,observedEdgePaths:[]},legacyChatRulesAudited:true,serverBlockRulesVerified:true,clientWriteRulesVerified:true}).enabled,false);
});
