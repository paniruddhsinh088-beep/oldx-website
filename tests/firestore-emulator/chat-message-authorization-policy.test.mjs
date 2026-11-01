import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeChatMutation,
  validateChatAttachmentMetadata,
  validateImmutableMessageFields,
  validateMessageId
} from "../../scripts/chat-message-authorization-policy.mjs";

const participants = ["synthetic-a", "synthetic-b"];

test("non-participant cannot mutate a chat", () => {
  assert.deepEqual(authorizeChatMutation({
    action: "send", actorUid: "synthetic-outsider", senderUid: "synthetic-outsider", participants
  }), { ok: false, error: "not_participant" });
});

test("malformed chat membership fails closed for every mutation", () => {
  for (const malformed of [undefined, [], ["synthetic-a"], ["synthetic-a", "synthetic-a"], ["synthetic-a", "synthetic-b", "synthetic-c"], ["synthetic-a", null]]) {
    assert.equal(authorizeChatMutation({
      action: "send", actorUid: "synthetic-a", senderUid: "synthetic-a", participants: malformed
    }).ok, false);
  }
});

test("sender UID spoofing is rejected before message send", () => {
  assert.equal(authorizeChatMutation({
    action: "send", actorUid: "synthetic-a", senderUid: "synthetic-b", participants
  }).error, "sender_mismatch");
  assert.deepEqual(authorizeChatMutation({
    action: "send", actorUid: "synthetic-a", senderUid: "synthetic-a", participants
  }), { ok: true });
});

test("blocked participant cannot send", () => {
  assert.equal(authorizeChatMutation({
    action: "send", actorUid: "synthetic-a", senderUid: "synthetic-a", participants, blocked: true
  }).error, "blocked");
});

test("only original sender can delete for everyone", () => {
  assert.equal(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-a", senderUid: "synthetic-a", participants
  }).ok, true);
  assert.equal(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-b", senderUid: "synthetic-a", participants
  }).error, "not_message_owner");
});

test("ordinary participant cannot reverse a tombstone", () => {
  assert.equal(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-a", senderUid: "synthetic-a", participants, tombstoned: true
  }).error, "already_tombstoned");
});

test("hide-for-self cannot target another participant", () => {
  assert.equal(authorizeChatMutation({
    action: "hide_for_self", actorUid: "synthetic-a", senderUid: "synthetic-b",
    participants, targetUid: "synthetic-b"
  }).error, "cannot_change_other_visibility");
  assert.equal(authorizeChatMutation({
    action: "hide_for_self", actorUid: "synthetic-a", senderUid: "synthetic-b",
    participants, targetUid: "synthetic-a"
  }).ok, true);
});

test("unknown actions fail closed", () => {
  assert.equal(authorizeChatMutation({
    action: "admin_override", actorUid: "synthetic-a", senderUid: "synthetic-a", participants
  }).error, "unsupported_action");
});

test("immutable sender, creation time and sequence cannot change", () => {
  const before = { senderUid: "synthetic-a", createdAt: 100, sequence: 4, text: "hello" };
  assert.equal(validateImmutableMessageFields(before, { ...before, text: "edited" }).ok, true);
  for (const key of ["senderUid", "createdAt", "sequence"]) {
    assert.equal(validateImmutableMessageFields(before, { ...before, [key]: "changed" }).error, "immutable_field_changed");
  }
});

test("attachment metadata must satisfy trusted allowlist and size configuration", () => {
  const policy = { allowedTypes: ["image/jpeg", "application/pdf"], maxBytes: 1000 };
  assert.equal(validateChatAttachmentMetadata({ name: "photo.jpg", type: "image/jpeg", byteLength: 500 }, policy).ok, true);
  assert.equal(validateChatAttachmentMetadata({ name: "bad.exe", type: "application/octet-stream", byteLength: 50 }, policy).ok, false);
  assert.equal(validateChatAttachmentMetadata({ name: "large.pdf", type: "application/pdf", byteLength: 1001 }, policy).error, "invalid_size");
  assert.equal(validateChatAttachmentMetadata({ name: "../secret", type: "application/pdf", byteLength: 50 }, policy).error, "invalid_name");
  assert.equal(validateChatAttachmentMetadata({ name: "bad" + String.fromCharCode(1) + "name.pdf", type: "application/pdf", byteLength: 50 }, policy).error, "invalid_name");
});

test("message identifiers are strictly bounded", () => {
  assert.equal(validateMessageId("msg_001"), true);
  assert.equal(validateMessageId("../msg"), false);
  assert.equal(validateMessageId(""), false);
});


test("recipient cannot tombstone a message they did not send", () => {
  assert.deepEqual(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-b", senderUid: "synthetic-a", participants
  }), { ok: false, error: "not_message_owner" });
});

test("original sender may tombstone a message only while it is not already tombstoned", () => {
  assert.deepEqual(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-a", senderUid: "synthetic-a", participants, tombstoned: false
  }), { ok: true });
  assert.deepEqual(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-a", senderUid: "synthetic-a", participants, tombstoned: true
  }), { ok: false, error: "already_tombstoned" });
});

test("tombstone restoration or rewriting actions are not supported", () => {
  for (const action of ["restore_message", "edit_tombstone", "clear_deleted_at"]) {
    assert.deepEqual(authorizeChatMutation({
      action, actorUid: "synthetic-a", senderUid: "synthetic-a", participants, tombstoned: true
    }), { ok: false, error: "unsupported_action" });
  }
});

test("invalid sender identity cannot authorize tombstone mutation", () => {
  assert.deepEqual(authorizeChatMutation({
    action: "delete_for_everyone", actorUid: "synthetic-a", senderUid: "", participants
  }), { ok: false, error: "invalid_sender" });
});
