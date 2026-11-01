/**
 * Review-only feedback input normalization.
 * Does not authorize a review or save anything. The backend must check
 * enquiry ownership, one-review-per-enquiry and moderation atomically.
 */
export function normalizeProviderReview(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype) {
    return { ok: false, code: "INVALID_REVIEW" };
  }
  const allowed = new Set(["rating", "comment"]);
  if (Object.keys(input).some(key => !allowed.has(key))) {
    return { ok: false, code: "UNSUPPORTED_REVIEW_FIELD" };
  }
  const { rating, comment = "" } = input;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof comment !== "string" || comment.length > 1000 ||
      /[<>\u0000-\u001f\u007f]/u.test(comment)) {
    return { ok: false, code: "INVALID_REVIEW" };
  }
  return { ok: true, value: { rating, comment: comment.trim() } };
}

/** Calculate a display summary only from trusted, already-approved ratings. */
export function summarizeApprovedRatings(ratings) {
  if (!Array.isArray(ratings) ||
      ratings.some(rating => !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { ok: false, code: "INVALID_RATINGS" };
  }
  const count = ratings.length;
  const average = count ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / count) * 10) / 10 : null;
  return { ok: true, count, average };
}
