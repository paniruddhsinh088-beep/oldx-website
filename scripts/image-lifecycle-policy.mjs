const TRANSITIONS = Object.freeze({
  upload_authorized: new Set(["quarantined", "deleted"]),
  quarantined: new Set(["processing", "rejected", "deleted"]),
  processing: new Set(["approved", "rejected", "deleted"]),
  approved: new Set(["deleted"]),
  rejected: new Set(["deleted"]),
  deleted: new Set(),
});

const SURFACES = new Set(["product", "store", "profile", "chat"]);

export function canTransitionImageStatus(from, to) {
  return Boolean(TRANSITIONS[from]?.has(to));
}

// Pure policy model only: callers must supply identity and relationship facts
// already verified by a trusted backend. This module does not authenticate anyone.
export function authorizeImageRead({ surface, status, listingPublished = false, viewerUid, ownerUid, isChatParticipant = false, storeIsPublic = true } = {}) {
  if (!SURFACES.has(surface) || status !== "approved") return false;
  if (typeof viewerUid !== "string" || !viewerUid) return false;
  if (surface === "product") return listingPublished === true;
  if (surface === "store") return storeIsPublic === true;
  if (surface === "profile") return viewerUid === ownerUid;
  if (surface === "chat") return isChatParticipant === true;
  return false;
}

export function authorizeImageMutation({ actorUid, ownerUid, isChatParticipant = false, surface } = {}) {
  if (typeof actorUid !== "string" || !actorUid) return false;
  if (surface === "chat") return isChatParticipant === true;
  if (!SURFACES.has(surface)) return false;
  return actorUid === ownerUid;
}

export function canPublishProductImage({ status, listingPublished, moderationApproved } = {}) {
  return status === "approved" && listingPublished === true && moderationApproved === true;
}

export function canExposeImageReference({ surface, status, listingPublished = false, moderationApproved = false } = {}) {
  if (surface === "product") return canPublishProductImage({ status, listingPublished, moderationApproved });
  if (surface === "store") return status === "approved" && moderationApproved === true;
  return false;
}
