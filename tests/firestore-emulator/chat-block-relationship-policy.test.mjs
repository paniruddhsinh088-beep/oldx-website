import test from "node:test";
import assert from "node:assert/strict";
import { authorizeBlockRelationship, authorizeMessageAgainstBlock } from "../../scripts/chat-block-relationship-policy.mjs";

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
