import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizePrivateChatStateAccess,
  validatePrivateChatStateIntent,
  advancePrivateReadCursor
} from "../../scripts/chat-private-user-state-policy.mjs";

const participants = ["synthetic-user-a", "synthetic-user-b"];

test("participant can read and request changes only to their own state document", () => {
  assert.equal(authorizePrivateChatStateAccess({
    verifiedUid: participants[0], pathUid: participants[0], participants, operation: "read"
  }).ok, true);
  assert.equal(authorizePrivateChatStateAccess({
    verifiedUid: participants[0], pathUid: participants[1], participants, operation: "read"
  }).code, "FORBIDDEN");
});

test("non-participants and malformed memberships fail closed", () => {
  assert.equal(authorizePrivateChatStateAccess({
    verifiedUid: "synthetic-outsider", pathUid: "synthetic-outsider",
    participants, operation: "read"
  }).ok, false);
  assert.equal(authorizePrivateChatStateAccess({
    verifiedUid: participants[0], pathUid: participants[0],
    participants: [participants[0], participants[0]], operation: "read"
  }).ok, false);
  assert.equal(authorizePrivateChatStateAccess({
    verifiedUid: participants[0], pathUid: participants[0],
    participants: [participants[0]], operation: "read"
  }).ok, false);
});

test("only explicitly supported state operations are accepted", () => {
  assert.equal(authorizePrivateChatStateAccess({
    verifiedUid: participants[0], pathUid: participants[0], participants, operation: "delete_parent"
  }).code, "UNSUPPORTED_OPERATION");
});

test("read-through intent accepts a valid bounded message cursor request", () => {
  const result = validatePrivateChatStateIntent({
    verifiedUid: participants[0], pathUid: participants[0], participants,
    intent: "request_read_through",
    payload: { messageId: "message_10", sequence: 10 },
    latestSequence: 12
  });
  assert.equal(result.ok, true);
});

test("read cursor request cannot target a future or malformed sequence", () => {
  for (const sequence of [0, -1, 13, Number.MAX_SAFE_INTEGER + 1, "10"]) {
    assert.equal(validatePrivateChatStateIntent({
      verifiedUid: participants[0], pathUid: participants[0], participants,
      intent: "request_read_through",
      payload: { messageId: "message_10", sequence },
      latestSequence: 12
    }).ok, false);
  }
});

test("client cannot set unread counts, read timestamps, cursor storage fields or unknown keys", () => {
  for (const payload of [
    { messageId: "message_10", sequence: 10, unreadCount: 0 },
    { messageId: "message_10", sequence: 10, lastReadAt: "forged" },
    { messageId: "message_10", sequence: 10, lastReadSequence: 10 },
    { messageId: "message_10", sequence: 10, admin: true }
  ]) {
    assert.equal(validatePrivateChatStateIntent({
      verifiedUid: participants[0], pathUid: participants[0], participants,
      intent: "request_read_through", payload, latestSequence: 12
    }).ok, false);
  }
});

test("hide and unhide requests are scoped to one valid message ID", () => {
  for (const intent of ["hide_message", "unhide_message"]) {
    assert.equal(validatePrivateChatStateIntent({
      verifiedUid: participants[0], pathUid: participants[0], participants,
      intent, payload: { messageId: "message_1" }, latestSequence: 1
    }).ok, true);
    assert.equal(validatePrivateChatStateIntent({
      verifiedUid: participants[0], pathUid: participants[0], participants,
      intent, payload: { messageId: "../other-user" }, latestSequence: 1
    }).ok, false);
    assert.equal(validatePrivateChatStateIntent({
      verifiedUid: participants[0], pathUid: participants[0], participants,
      intent, payload: { messageId: "message_1", hiddenFor: [participants[1]] },
      latestSequence: 1
    }).ok, false);
  }
});

test("typing intent accepts only a boolean active flag", () => {
  assert.equal(validatePrivateChatStateIntent({
    verifiedUid: participants[0], pathUid: participants[0], participants,
    intent: "set_typing", payload: { active: true }, latestSequence: 1
  }).ok, true);
  assert.equal(validatePrivateChatStateIntent({
    verifiedUid: participants[0], pathUid: participants[0], participants,
    intent: "set_typing", payload: { active: true, uid: participants[1] }, latestSequence: 1
  }).ok, false);
});

test("read cursor advances monotonically and is bounded by the latest known sequence", () => {
  assert.deepEqual(advancePrivateReadCursor(4, 7, 9), {
    ok: true, sequence: 7, changed: true
  });
  assert.deepEqual(advancePrivateReadCursor(7, 4, 9), {
    ok: true, sequence: 7, changed: false
  });
  assert.equal(advancePrivateReadCursor(4, 10, 9).ok, false);
  assert.equal(advancePrivateReadCursor(-1, 2, 9).ok, false);
});
