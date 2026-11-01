import test from "node:test";
import assert from "node:assert/strict";
import { advanceReadCursor, applySyntheticUnreadEvent } from "../../scripts/chat-read-receipt-policy.mjs";

test("read cursor advances monotonically", () => {
  assert.deepEqual(advanceReadCursor(4, 7), { ok: true, sequence: 7, changed: true });
  assert.deepEqual(advanceReadCursor(7, 4), { ok: true, sequence: 7, changed: false });
});

test("invalid or future-shaped sequence values fail closed", () => {
  assert.equal(advanceReadCursor(-1, 3).ok, false);
  assert.equal(advanceReadCursor(2, 0).ok, false);
  assert.equal(advanceReadCursor(2, Number.MAX_SAFE_INTEGER + 1).ok, false);
});

test("synthetic incoming message increments only the recipient's unread count", () => {
  const result = applySyntheticUnreadEvent({
    unreadCount: 2, senderUid: "synthetic-a", recipientUid: "synthetic-b",
    eventId: "event_001", processedEventIds: []
  });
  assert.equal(result.ok, true);
  assert.equal(result.unreadCount, 3);
});

test("duplicate delivery event does not double increment", () => {
  const result = applySyntheticUnreadEvent({
    unreadCount: 3, senderUid: "synthetic-a", recipientUid: "synthetic-b",
    eventId: "event_001", processedEventIds: ["event_001"]
  });
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.unreadCount, 3);
});

test("self-message and malformed event state are rejected", () => {
  assert.equal(applySyntheticUnreadEvent({
    unreadCount: 0, senderUid: "same", recipientUid: "same",
    eventId: "event_001", processedEventIds: []
  }).ok, false);
  assert.equal(applySyntheticUnreadEvent({
    unreadCount: -1, senderUid: "a", recipientUid: "b",
    eventId: "event_001", processedEventIds: []
  }).ok, false);
});
