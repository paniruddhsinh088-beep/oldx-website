/**
 * Review-only buyer review eligibility decision.
 * The trusted backend MUST load the enquiry and review records itself and
 * atomically enforce uniqueness, ownership and moderation before writing.
 * Never trust these flags directly from a browser.
 */
export function checkProviderReviewEligibility(context) {
  if (!context || typeof context !== "object" || Array.isArray(context) ||
      Object.getPrototypeOf(context) !== Object.prototype) {
    return { ok: false, code: "INVALID_REVIEW_CONTEXT" };
  }
  const { signedIn, buyerUid, providerOwnerUid, enquiryBuyerUid,
    enquiryProviderOwnerUid, enquiryStatus, alreadyReviewed, blocked } = context;
  if (typeof signedIn !== "boolean" || typeof alreadyReviewed !== "boolean" ||
      typeof blocked !== "boolean" ||
      [buyerUid, providerOwnerUid, enquiryBuyerUid, enquiryProviderOwnerUid]
        .some(id => typeof id !== "string" || !id.trim()) ||
      !["completed", "qualifying_enquiry", "pending", "cancelled"].includes(enquiryStatus)) {
    return { ok: false, code: "INVALID_REVIEW_CONTEXT" };
  }
  if (!signedIn) return { ok: true, eligible: false, reason: "SIGN_IN_REQUIRED" };
  if (blocked) return { ok: true, eligible: false, reason: "BLOCKED" };
  if (buyerUid === providerOwnerUid) return { ok: true, eligible: false, reason: "SELF_REVIEW" };
  if (buyerUid !== enquiryBuyerUid || providerOwnerUid !== enquiryProviderOwnerUid) {
    return { ok: true, eligible: false, reason: "ENQUIRY_MISMATCH" };
  }
  if (!["completed", "qualifying_enquiry"].includes(enquiryStatus)) {
    return { ok: true, eligible: false, reason: "ENQUIRY_NOT_QUALIFIED" };
  }
  if (alreadyReviewed) return { ok: true, eligible: false, reason: "ALREADY_REVIEWED" };
  return { ok: true, eligible: true, reason: null };
}
