/** Read-only reconciliation planner. Caller must supply complete legacy user records. */
import {inspectLegacyBlocks} from "./legacy-block-preflight.js";
export function planLegacyBlockEdges(records) {
  if (!Array.isArray(records)) throw new TypeError("Expected complete user records array");
  const seenOwners=new Set();
  const paths=[];
  for (const record of records) {
    if (!record || typeof record!=="object" || seenOwners.has(record.uid)) throw new TypeError("Duplicate or invalid user record");
    const edges=inspectLegacyBlocks(record.uid,record.blockedUsers);
    seenOwners.add(record.uid);
    for (const edge of edges) paths.push(Object.freeze({path:`serviceChatBlocks/${edge.blockerUid}/blocked/${edge.blockedUid}`,...edge}));
  }
  return Object.freeze({owners:seenOwners.size,edgeCount:paths.length,edges:Object.freeze(paths)});
}
