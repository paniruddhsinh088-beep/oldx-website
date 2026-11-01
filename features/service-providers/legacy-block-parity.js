/** Compare a complete planned migration with observed edge paths. Read-only. */
export function auditBlockEdgeParity(plan, observedPaths) {
  if (!plan || !Array.isArray(plan.edges) || !Array.isArray(observedPaths)) throw new TypeError("Invalid parity inputs");
  const expected=new Set(plan.edges.map(e=>e.path));
  if (expected.size!==plan.edges.length) throw new TypeError("Duplicate planned edges");
  const actual=new Set();
  for(const path of observedPaths) {
    if(typeof path!=="string" || !/^serviceChatBlocks\/[A-Za-z0-9_-]{1,128}\/blocked\/[A-Za-z0-9_-]{1,128}$/.test(path) || actual.has(path)) throw new TypeError("Invalid or duplicate observed edge");
    actual.add(path);
  }
  const missing=[...expected].filter(p=>!actual.has(p));
  const unexpected=[...actual].filter(p=>!expected.has(p));
  return Object.freeze({matches:missing.length===0&&unexpected.length===0,expectedCount:expected.size,observedCount:actual.size,missing:Object.freeze(missing),unexpected:Object.freeze(unexpected)});
}
