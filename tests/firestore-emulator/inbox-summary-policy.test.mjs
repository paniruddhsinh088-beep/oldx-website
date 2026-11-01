import test from "node:test";
import assert from "node:assert/strict";
import { validateInboxSummary, validateInboxPageRequest, INBOX_PAGE_DEFAULT, INBOX_PAGE_MAX } from "../../scripts/inbox-summary-policy.mjs";

const valid = {
  chatId: "chat_synthetic_01",
  participantUids: ["synthetic-user-a", "synthetic-user-b"],
  unreadCount: 2,
  lastMessageSenderUid: "synthetic-user-b",
  lastMessagePreview: "Synthetic test message",
  lastMessageAtMillis: 1_800_000_000_000,
  schemaVersion: 1
};

test("accepts a well-formed summary only for a listed participant", () => {
  const result = validateInboxSummary(valid, "synthetic-user-a");
  assert.equal(result.ok, true);
  assert.equal(result.value.chatId, valid.chatId);
  assert.equal(result.value.unreadCount, 2);
});

test("rejects unauthenticated callers and non-participants", () => {
  assert.ok(validateInboxSummary(valid, "").errors.includes("authentication_required"));
  assert.ok(validateInboxSummary(valid, "synthetic-outsider").errors.includes("caller_not_participant"));
});

test("rejects client-controlled invalid membership and unread counters", () => {
  assert.ok(validateInboxSummary({ ...valid, participantUids: ["synthetic-user-a"] }, "synthetic-user-a").errors.includes("invalid_participants"));
  assert.ok(validateInboxSummary({ ...valid, unreadCount: -1 }, "synthetic-user-a").errors.includes("invalid_unread_count"));
  assert.ok(validateInboxSummary({ ...valid, unreadCount: 1.5 }, "synthetic-user-a").errors.includes("invalid_unread_count"));
});

test("rejects oversized previews, malformed timestamps and unknown schema versions", () => {
  assert.ok(validateInboxSummary({ ...valid, lastMessagePreview: "x".repeat(161) }, "synthetic-user-a").errors.includes("invalid_preview"));
  assert.ok(validateInboxSummary({ ...valid, lastMessageAtMillis: NaN }, "synthetic-user-a").errors.includes("invalid_message_time"));
  assert.ok(validateInboxSummary({ ...valid, schemaVersion: 2 }, "synthetic-user-a").errors.includes("unsupported_schema_version"));
});

test("page requests are bounded and cursor-based", () => {
  assert.equal(INBOX_PAGE_DEFAULT, 20);
  assert.equal(INBOX_PAGE_MAX, 30);
  assert.equal(validateInboxPageRequest({ authenticatedUid: "synthetic-user-a", pageSize: 20 }).ok, true);
  assert.equal(validateInboxPageRequest({ authenticatedUid: "synthetic-user-a", pageSize: 31 }).ok, false);
  assert.equal(validateInboxPageRequest({ authenticatedUid: "synthetic-user-a", pageSize: 20, cursor: { chatId: "c1", lastMessageAtMillis: 10 } }).ok, true);
  assert.equal(validateInboxPageRequest({ authenticatedUid: "synthetic-user-a", pageSize: 20, cursor: { chatId: "c1", lastMessageAtMillis: -1 } }).ok, false);
});
