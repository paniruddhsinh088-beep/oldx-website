import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeChatRead, authorizeChatSend, authorizeBlockChange,
  validateChatPage, sanitizeChatSummary,
} from "../../scripts/chat-privacy-policy.mjs";
const participants = ["user_A", "user_B"];

test("only chat participants can read messages", () => {
  assert.equal(authorizeChatRead({ verifiedUid: "user_A", participants }).visible, true);
  assert.equal(authorizeChatRead({ verifiedUid: "outsider", participants }).code, "FORBIDDEN");
});
test("hide-for-self applies only to the requesting participant", () => {
  assert.equal(authorizeChatRead({ verifiedUid: "user_A", participants, hiddenFor: ["user_A"] }).visible, false);
  assert.equal(authorizeChatRead({ verifiedUid: "user_B", participants, hiddenFor: ["user_A"] }).visible, true);
  assert.equal(authorizeChatRead({ verifiedUid: "user_B", participants, deletedForEveryone: true }).visible, false);
});
test("malformed visibility state fails closed", () => {
  assert.equal(authorizeChatRead({ verifiedUid: "user_A", participants, hiddenFor: ["user_B", 7] }).ok, false);
});
test("block in either direction prevents new messages", () => {
  const base = { verifiedUid: "user_A", senderUid: "user_A", recipientUid: "user_B", participants };
  assert.equal(authorizeChatSend(base).ok, true);
  assert.equal(authorizeChatSend({ ...base, blockEdges: [{ blockerUid: "user_A", blockedUid: "user_B" }] }).code, "BLOCKED");
  assert.equal(authorizeChatSend({ ...base, blockEdges: [{ blockerUid: "user_B", blockedUid: "user_A" }] }).code, "BLOCKED");
});
test("sender and recipient must match verified participant identities", () => {
  const base = { verifiedUid: "user_A", senderUid: "user_A", recipientUid: "user_B", participants };
  assert.equal(authorizeChatSend({ ...base, senderUid: "user_B" }).ok, false);
  assert.equal(authorizeChatSend({ ...base, recipientUid: "outsider" }).ok, false);
});
test("only account owner may change their block list", () => {
  assert.equal(authorizeBlockChange({ verifiedUid: "user_A", ownerUid: "user_A", targetUid: "user_B" }).ok, true);
  assert.equal(authorizeBlockChange({ verifiedUid: "user_B", ownerUid: "user_A", targetUid: "user_B" }).ok, false);
  assert.equal(authorizeBlockChange({ verifiedUid: "user_A", ownerUid: "user_A", targetUid: "user_A" }).ok, false);
});
test("chat page size and cursor are bounded", () => {
  assert.equal(validateChatPage().pageSize, 20);
  assert.equal(validateChatPage({ pageSize: 31 }).ok, false);
  assert.equal(validateChatPage({ pageSize: 0 }).ok, false);
  assert.equal(validateChatPage({ cursor: "../private" }).ok, false);
});
test("chat summary returns only safe participant-specific fields", () => {
  const result = sanitizeChatSummary({ participants, lastMessagePreview: "x".repeat(200),
    unreadCount: 2, updatedAt: "synthetic-time", internalNotes: "secret", moderation: "private" }, "user_A");
  assert.equal(result.ok, true);
  assert.deepEqual(result.summary.participants, ["user_B"]);
  assert.equal(result.summary.lastMessagePreview.length, 120);
  assert.equal("internalNotes" in result.summary, false);
  assert.equal("moderation" in result.summary, false);
});
test("outsiders and malformed unread counts cannot read summaries", () => {
  assert.equal(sanitizeChatSummary({ participants, unreadCount: 1 }, "outsider").code, "FORBIDDEN");
  assert.equal(sanitizeChatSummary({ participants, unreadCount: -1 }, "user_A").code, "INVALID_SUMMARY");
});
