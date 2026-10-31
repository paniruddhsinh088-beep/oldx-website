/**
 * Synthetic reference model for the proposed OLDX profile access matrix.
 * This is NOT Firestore Rules and does not enforce database authorization.
 */
const PUBLIC_FIELDS = new Set(["displayName", "photoURL"]);
const PRIVATE_FIELDS = new Set(["savedAds", "blockedUsers"]);

export function profileAccessDecision({ actorUid = null, ownerUid, resource, operation, fields = [] }) {
  if (!ownerUid || !["public", "private", "trusted"].includes(resource)) return false;

  if (resource === "trusted") return false;

  if (resource === "private") {
    if (!actorUid || actorUid !== ownerUid) return false;
    if (operation === "read") return true;
    if (operation === "create" || operation === "update") {
      return fields.length > 0 && fields.every(field => PRIVATE_FIELDS.has(field));
    }
    return false;
  }

  // Public profile reads are a candidate policy, pending explicit owner approval.
  if (resource === "public") {
    if (operation === "read") return true;
    if ((operation === "create" || operation === "update") && actorUid === ownerUid) {
      return fields.length > 0 && fields.every(field => PUBLIC_FIELDS.has(field));
    }
    return false;
  }

  return false;
}
