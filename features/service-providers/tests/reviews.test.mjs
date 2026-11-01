/**
 * Unit tests for review input and UI eligibility helpers.
 * Run: node --test features/service-providers/tests/reviews.test.mjs
 * These do NOT test Firebase security rules or verify real transactions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../reviews.js", import.meta.url), "utf8");
const { validateServiceReview, canRequestServiceReview, summarizeServiceReviews } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("accepts 1 and 5 star ratings", () => {
  assert.equal(validateServiceReview({ rating: 1, comment: "" }).valid, true);
  assert.equal(validateServiceReview({ rating: 5, comment: "Good" }).valid, true);
});
test("rejects non-integer and out-of-range ratings", () => {
  for (const rating of [0, 6, 2.5, "5", null, undefined]) {
    assert.equal(validateServiceReview({ rating }).valid, false);
  }
});
test("rejects comments over 500 characters", () =>
  assert.equal(validateServiceReview({ rating: 5, comment: "x".repeat(501) }).valid, false));
test("trims comments", () =>
  assert.equal(validateServiceReview({ rating: 5, comment: " Nice work " }).value.comment, "Nice work"));
const buyerUid = "buyerA", providerUid = "providerB";
const booking = { buyerUid, providerUid, status: "completed" };
test("permits UI review prompt for completed matching booking", () =>
  assert.equal(canRequestServiceReview({ buyerUid, providerUid, completedBooking: booking }), true));
test("rejects provider self-review prompt", () =>
  assert.equal(canRequestServiceReview({ buyerUid: providerUid, providerUid, completedBooking: booking }), false));
test("rejects pending booking prompt", () =>
  assert.equal(canRequestServiceReview({ buyerUid, providerUid, completedBooking: {...booking, status: "pending"} }), false));
test("rejects wrong buyer or provider on booking", () => {
  assert.equal(canRequestServiceReview({ buyerUid, providerUid, completedBooking: {...booking, buyerUid: "other"} }), false);
  assert.equal(canRequestServiceReview({ buyerUid, providerUid, completedBooking: {...booking, providerUid: "other"} }), false);
});
test("counts only published valid ratings", () => {
  assert.deepEqual(summarizeServiceReviews([
    {status:"published", rating:5}, {status:"published", rating:4},
    {status:"pending", rating:1}, {status:"published", rating:6}
  ]), {count:2, average:4.5});
});
test("returns no average for empty reviews", () =>
  assert.deepEqual(summarizeServiceReviews([]), {count:0, average:null}));
