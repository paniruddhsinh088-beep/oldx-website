/**
 * OLDX service provider review eligibility and presentation.
 * This module intentionally performs NO writes. Eligibility must be checked
 * again in Firestore security rules using a trusted completed transaction.
 */
const text = value => typeof value === "string" ? value.trim() : "";

export function validateServiceReview(input) {
  const errors = {};
  const rating = input?.rating;
  const comment = text(input?.comment);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = "Choose a rating from 1 to 5.";
  }
  if (comment.length > 500) {
    errors.comment = "Review must be 500 characters or fewer.";
  }
  return { valid: Object.keys(errors).length === 0, errors, value: { rating, comment } };
}

export function canRequestServiceReview({ buyerUid, providerUid, completedBooking } = {}) {
  // UI-only convenience check. Not authorization.
  return typeof buyerUid === "string" && buyerUid.length > 0
    && typeof providerUid === "string" && providerUid.length > 0
    && buyerUid !== providerUid
    && completedBooking?.status === "completed"
    && completedBooking?.buyerUid === buyerUid
    && completedBooking?.providerUid === providerUid;
}

export function summarizeServiceReviews(reviews) {
  const valid = (Array.isArray(reviews) ? reviews : []).filter(item =>
    item?.status === "published" && Number.isInteger(item.rating)
    && item.rating >= 1 && item.rating <= 5
  );
  const count = valid.length;
  return {
    count,
    average: count ? Math.round(valid.reduce((sum, item) => sum + item.rating, 0) / count * 10) / 10 : null
  };
}

export function mountServiceReviewSummary(container, reviews = []) {
  if (!(container instanceof HTMLElement)) throw new TypeError("Container must be an element");
  const summary = summarizeServiceReviews(reviews);
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = "Buyer reviews";
  const stats = document.createElement("p");
  stats.textContent = summary.count
    ? summary.average.toFixed(1) + " / 5 · " + summary.count + (summary.count === 1 ? " review" : " reviews")
    : "No verified reviews yet";
  section.append(heading, stats);
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (review?.status !== "published" || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) continue;
    const item = document.createElement("article");
    const score = document.createElement("strong");
    score.textContent = review.rating + " / 5";
    const comment = document.createElement("p");
    comment.textContent = text(review.comment).slice(0, 500);
    item.append(score, comment);
    section.append(item);
  }
  container.replaceChildren(section);
  return { destroy: () => section.remove() };
}
