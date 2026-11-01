import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionImageStatus, authorizeImageRead, authorizeImageMutation, canPublishProductImage, canExposeImageReference } from "../../scripts/image-lifecycle-policy.mjs";

test("allows only declared forward lifecycle transitions", () => {
  assert.equal(canTransitionImageStatus("upload_authorized", "quarantined"), true);
  assert.equal(canTransitionImageStatus("quarantined", "processing"), true);
  assert.equal(canTransitionImageStatus("processing", "approved"), true);
  assert.equal(canTransitionImageStatus("processing", "rejected"), true);
  assert.equal(canTransitionImageStatus("approved", "processing"), false);
  assert.equal(canTransitionImageStatus("rejected", "approved"), false);
  assert.equal(canTransitionImageStatus("deleted", "approved"), false);
  assert.equal(canTransitionImageStatus("unknown", "approved"), false);
});

test("requires approval and publication before product image exposure", () => {
  assert.equal(canExposeImageReference({ surface: "product", status: "approved", listingPublished: true, moderationApproved: true }), true);
  assert.equal(canExposeImageReference({ surface: "product", status: "approved", listingPublished: false, moderationApproved: true }), false);
  assert.equal(canExposeImageReference({ surface: "product", status: "approved", listingPublished: true, moderationApproved: false }), false);
  assert.equal(canExposeImageReference({ surface: "product", status: "processing", listingPublished: true, moderationApproved: true }), false);
});

test("store image requires moderation and approved status", () => {
  assert.equal(canExposeImageReference({ surface: "store", status: "approved", moderationApproved: true }), true);
  assert.equal(canExposeImageReference({ surface: "store", status: "approved", moderationApproved: false }), false);
  assert.equal(canExposeImageReference({ surface: "store", status: "quarantined", moderationApproved: true }), false);
});

test("product reads require approved image and published listing", () => {
  assert.equal(authorizeImageRead({ surface: "product", status: "approved", listingPublished: true, viewerUid: "viewer" }), true);
  assert.equal(authorizeImageRead({ surface: "product", status: "approved", listingPublished: false, viewerUid: "viewer" }), false);
  assert.equal(authorizeImageRead({ surface: "product", status: "processing", listingPublished: true, viewerUid: "viewer" }), false);
});

test("store read is public only for approved image", () => {
  assert.equal(authorizeImageRead({ surface: "store", status: "approved", viewerUid: "viewer" }), true);
  assert.equal(authorizeImageRead({ surface: "store", status: "approved", viewerUid: "viewer", storeIsPublic: false }), false);
});

test("profile and chat reads remain private", () => {
  assert.equal(authorizeImageRead({ surface: "profile", status: "approved", viewerUid: "owner", ownerUid: "owner" }), true);
  assert.equal(authorizeImageRead({ surface: "profile", status: "approved", viewerUid: "other", ownerUid: "owner" }), false);
  assert.equal(authorizeImageRead({ surface: "chat", status: "approved", viewerUid: "member", isChatParticipant: true }), true);
  assert.equal(authorizeImageRead({ surface: "chat", status: "approved", viewerUid: "outsider", isChatParticipant: false }), false);
});

test("only owner can mutate non-chat images; verified chat participants may mutate chat attachments", () => {
  assert.equal(authorizeImageMutation({ actorUid: "owner", ownerUid: "owner", surface: "product" }), true);
  assert.equal(authorizeImageMutation({ actorUid: "attacker", ownerUid: "owner", surface: "product" }), false);
  assert.equal(authorizeImageMutation({ actorUid: "member", surface: "chat", isChatParticipant: true }), true);
  assert.equal(authorizeImageMutation({ actorUid: "outsider", surface: "chat", isChatParticipant: false }), false);
});

test("unknown surfaces and unauthenticated viewers fail closed", () => {
  assert.equal(authorizeImageRead({ surface: "admin", status: "approved", viewerUid: "viewer" }), false);
  assert.equal(authorizeImageRead({ surface: "chat", status: "approved", viewerUid: "" , isChatParticipant: true }), false);
});
