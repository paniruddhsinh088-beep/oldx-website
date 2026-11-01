/** Read-only go/no-go gate. Never authorizes a Firestore write. */
import {planLegacyBlockEdges} from "./legacy-block-reconciliation.js";
import {auditBlockEdgeParity} from "./legacy-block-parity.js";
export function evaluateLegacyBlockMigration({legacyRecords,observedEdgePaths,legacySnapshotComplete=false,edgeSnapshotComplete=false}={}) {
  if(legacySnapshotComplete!==true || edgeSnapshotComplete!==true) return Object.freeze({ready:false,reason:"incomplete-snapshot"});
  try {
    const plan=planLegacyBlockEdges(legacyRecords);
    const parity=auditBlockEdgeParity(plan,observedEdgePaths);
    return Object.freeze({ready:parity.matches,reason:parity.matches?"parity-verified":"parity-mismatch",owners:plan.owners,expectedEdges:parity.expectedCount,observedEdges:parity.observedCount});
  } catch {
    return Object.freeze({ready:false,reason:"invalid-snapshot"});
  }
}
