import test from "node:test";
import assert from "node:assert/strict";
import { authorizeBlockRelationship, authorizeMessageAgainstBlock, deriveOtherChatParticipant, authorizeChatCreation } from "../../scripts/chat-block-relationship-policy.mjs";

test("only the blocker can create or remove their own relationship", () => {
  assert.deepEqual(authorizeBlockRelationship({ actorUid: "a", blockerUid: "a", blockedUid: "b", action: "block" }), { ok: true });
  assert.deepEqual(authorizeBlockRelationship({ actorUid: "a", blockerUid: "a", blockedUid: "b", action: "unblock" }), { ok: true });
  assert.equal(authorizeBlockRelationship({ actorUid: "b", blockerUid: "a", blockedUid: "b", action: "block" }).error, "not_block_owner");
});

test("self-block and malformed relationship fail closed", () => {
  assert.equal(authorizeBlockRelationship({ actorUid: "a", blockerUid: "a", blockedUid: "a", action: "block" }).error, "invalid_relationship");
  assert.equal(authorizeBlockRelationship({ actorUid: "a", blockerUid: "a", blockedUid: "", action: "block" }).error, "invalid_relationship");
});

test("unsupported relationship actions fail closed", () => {
  assert.equal(authorizeBlockRelationship({ actorUid: "a", blockerUid: "a", blockedUid: "b", action: "read_all" }).error, "unsupported_action");
});

test("a recipient block rejects the sender", () => {
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "b", chatParticipants: ["a", "b"], blockedByRecipient: true }).error, "blocked_by_recipient");
});

test("an unblocked two-party chat can pass the block gate", () => {
  assert.deepEqual(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "b", chatParticipants: ["a", "b"], blockedByRecipient: false }), { ok: true });
});

test("unknown block state fails closed", () => {
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "b", chatParticipants: ["a", "b"] }).error, "block_state_unverified");
});

test("spoofed recipient and malformed membership fail closed", () => {
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "c", chatParticipants: ["a", "b"], blockedByRecipient: false }).error, "invalid_chat_membership");
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "b", chatParticipants: ["a", "b", "c"], blockedByRecipient: false }).error, "invalid_chat_membership");
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "a", chatParticipants: ["a", "b"], blockedByRecipient: false }).error, "invalid_chat_membership");
});

test("derive recipient from canonical two-party chat membership in either participant order", () => {
  assert.deepEqual(deriveOtherChatParticipant({ actorUid: "a", participants: ["a", "b"] }), { ok: true, otherUid: "b" });
  assert.deepEqual(deriveOtherChatParticipant({ actorUid: "b", participants: ["a", "b"] }), { ok: true, otherUid: "a" });
});

test("malformed or spoofed chat membership cannot derive a recipient", () => {
  for (const participants of [undefined, [], ["a"], ["a", "a"], ["a", "b", "c"], ["a", null]]) {
    assert.equal(deriveOtherChatParticipant({ actorUid: "a", participants }).ok, false);
  }
  assert.equal(deriveOtherChatParticipant({ actorUid: "outsider", participants: ["a", "b"] }).error, "invalid_chat_membership");
});

test("blocking in either direction denies the corresponding sender", () => {
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "a", recipientUid: "b", chatParticipants: ["a", "b"], blockedByRecipient: true }).error, "blocked_by_recipient");
  assert.equal(authorizeMessageAgainstBlock({ senderUid: "b", recipientUid: "a", chatParticipants: ["a", "b"], blockedByRecipient: true }).error, "blocked_by_recipient");
});

test("chat creation shape requires authenticated buyer and two distinct participants", () => {
  assert.deepEqual(authorizeChatCreation({ actorUid: "buyer", buyerUid: "buyer", sellerUid: "seller", productId: "p1", participants: ["buyer", "seller"] }), { ok: true });
  assert.equal(authorizeChatCreation({ actorUid: "seller", buyerUid: "buyer", sellerUid: "seller", productId: "p1", participants: ["buyer", "seller"] }).error, "invalid_chat_creation");
  // The pure helper validates shape/actor binding only; Rules must obtain sellerUid from products/{productId}, never from client input.
});

test("chat creation rejects self-chat, malformed members and missing product identity", () => {
  const base = { actorUid: "buyer", buyerUid: "buyer", sellerUid: "seller", productId: "p1", participants: ["buyer", "seller"] };
  for (const patch of [
    { sellerUid: "buyer", participants: ["buyer", "buyer"] },
    { participants: ["buyer"] },
    { participants: ["buyer", "seller", "third"] },
    { productId: "" },
    { buyerUid: "someone-else" }
  ]) assert.equal(authorizeChatCreation({ ...base, ...patch }).ok, false);
});
