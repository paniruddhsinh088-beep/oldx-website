import test from "node:test";
import assert from "node:assert/strict";
import { checkProviderReviewEligibility } from "./provider-review-eligibility.mjs";

const valid = {
  signedIn: true, buyerUid: "buyer-1", providerOwnerUid: "seller-1",
  enquiryBuyerUid: "buyer-1", enquiryProviderOwnerUid: "seller-1",
  enquiryStatus: "completed", alreadyReviewed: false, blocked: false
};

test("allows linked buyer after completed job or qualifying enquiry", () => {
  assert.deepEqual(checkProviderReviewEligibility(valid), { ok: true, eligible: true, reason: null });
  assert.equal(checkProviderReviewEligibility({ ...valid, enquiryStatus: "qualifying_enquiry" }).eligible, true);
});

test("prevents self-reviews and unrelated buyers", () => {
  assert.equal(checkProviderReviewEligibility({
    ...valid, buyerUid: "seller-1", enquiryBuyerUid: "seller-1"
  }).reason, "SELF_REVIEW");
  assert.equal(checkProviderReviewEligibility({ ...valid, enquiryBuyerUid: "other" }).reason, "ENQUIRY_MISMATCH");
  assert.equal(checkProviderReviewEligibility({ ...valid, enquiryProviderOwnerUid: "other" }).reason, "ENQUIRY_MISMATCH");
});

test("prevents duplicate, cancelled and pending reviews", () => {
  assert.equal(checkProviderReviewEligibility({ ...valid, alreadyReviewed: true }).reason, "ALREADY_REVIEWED");
  assert.equal(checkProviderReviewEligibility({ ...valid, enquiryStatus: "cancelled" }).eligible, false);
  assert.equal(checkProviderReviewEligibility({ ...valid, enquiryStatus: "pending" }).eligible, false);
});

test("guests and blocked users cannot review", () => {
  assert.equal(checkProviderReviewEligibility({ ...valid, signedIn: false }).reason, "SIGN_IN_REQUIRED");
  assert.equal(checkProviderReviewEligibility({ ...valid, blocked: true }).reason, "BLOCKED");
});

test("malformed or missing trusted context fails closed", () => {
  for (const input of [null, {}, { ...valid, buyerUid: " " }, { ...valid, alreadyReviewed: "false" }]) {
    assert.equal(checkProviderReviewEligibility(input).ok, false);
  }
});
