import {test} from "node:test";
import {strict as assert} from "node:assert";
import {evaluateLegacyBlockMigration as gate} from "../legacy-block-migration-gate.js";
const records=[{uid:"buyer",blockedUsers:["provider"]},{uid:"provider",blockedUsers:[]}];
const edges=["serviceChatBlocks/buyer/blocked/provider"];
test("requires explicit complete snapshots",()=>{
 assert.equal(gate({legacyRecords:records,observedEdgePaths:edges}).ready,false);
 assert.equal(gate({legacyRecords:records,observedEdgePaths:edges,legacySnapshotComplete:true}).reason,"incomplete-snapshot");
});
test("requires exact parity and valid data",()=>{
 assert.deepEqual(gate({legacyRecords:records,observedEdgePaths:edges,legacySnapshotComplete:true,edgeSnapshotComplete:true}),{ready:true,reason:"parity-verified",owners:2,expectedEdges:1,observedEdges:1});
 assert.equal(gate({legacyRecords:records,observedEdgePaths:[],legacySnapshotComplete:true,edgeSnapshotComplete:true}).ready,false);
 assert.equal(gate({legacyRecords:[{uid:"buyer"}],observedEdgePaths:edges,legacySnapshotComplete:true,edgeSnapshotComplete:true}).reason,"invalid-snapshot");
});
