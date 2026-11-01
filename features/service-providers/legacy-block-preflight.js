/** Pure migration preflight for OLDX legacy blockedUsers arrays. No Firestore writes. */
const uid = x => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
export function inspectLegacyBlocks(ownerUid, blockedUsers) {
  if (!uid(ownerUid)) throw new TypeError("Invalid owner UID");
  if (!Array.isArray(blockedUsers)) throw new TypeError("Legacy block list must be an array");
  const seen = new Set();
  const edges = [];
  for (const targetUid of blockedUsers) {
    if (!uid(targetUid) || targetUid === ownerUid) throw new TypeError("Invalid legacy blocked UID");
    if (seen.has(targetUid)) continue;
    seen.add(targetUid);
    edges.push(Object.freeze({blockerUid:ownerUid,blockedUid:targetUid}));
  }
  return Object.freeze(edges);
}
export function checkLegacyBlockPair({buyerUid,providerUid,buyerBlockedUsers,providerBlockedUsers}) {
  if (!uid(buyerUid) || !uid(providerUid) || buyerUid === providerUid) throw new TypeError("Invalid pair");
  const buyer = inspectLegacyBlocks(buyerUid,buyerBlockedUsers);
  const provider = inspectLegacyBlocks(providerUid,providerBlockedUsers);
  return Object.freeze({blockedByBuyer:buyer.some(x=>x.blockedUid===providerUid),blockedByProvider:provider.some(x=>x.blockedUid===buyerUid)});
}
