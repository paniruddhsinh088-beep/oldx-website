import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderReview, summarizeApprovedRatings } from "./provider-review-input.mjs";

test("accepts Gujarati feedback and valid 1–5 star ratings", () => {
  assert.deepEqual(normalizeProviderReview({ rating: 5, comment: " સારું કામ " }), {
    ok: true, value: { rating: 5, comment: "સારું કામ" }
  });
  assert.deepEqual(normalizeProviderReview({ rating: 1 }), {
    ok: true, value: { rating: 1, comment: "" }
  });
});

test("rejects invalid ratings and unsafe feedback", () => {
  for (const input of [
    { rating: 0 }, { rating: 6 }, { rating: 4.5 },
    { rating: "5" }, { rating: 5, comment: "<script>" },
    { rating: 5, comment: "a".repeat(1001) }
  ]) {
    assert.equal(normalizeProviderReview(input).ok, false);
  }
});

test("rejects forged buyer, provider and moderation fields", () => {
  for (const field of ["buyerUid", "providerUid", "enquiryId", "approved", "createdAt", "reviewCount"]) {
    assert.deepEqual(normalizeProviderReview({ rating: 5, [field]: "forged" }), {
      ok: false, code: "UNSUPPORTED_REVIEW_FIELD"
    });
  }
});

test("summarizes only supplied approved ratings without inventing a score", () => {
  assert.deepEqual(summarizeApprovedRatings([5, 4, 3]), { ok: true, count: 3, average: 4 });
  assert.deepEqual(summarizeApprovedRatings([]), { ok: true, count: 0, average: null });
  assert.deepEqual(summarizeApprovedRatings([5, 4, 4]), { ok: true, count: 3, average: 4.3 });
});

test("rejects malformed rating collections", () => {
  for (const input of [null, [6], [4.5], ["5"]]) {
    assert.equal(summarizeApprovedRatings(input).ok, false);
  }
});
