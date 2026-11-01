const MAX_PREVIEW_LENGTH = 160;
const MAX_PAGE_SIZE = 30;

export function validateInboxSummary(summary, authenticatedUid) {
  const errors = [];
  if (!authenticatedUid || typeof authenticatedUid !== "string") errors.push("authentication_required");
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return { ok: false, errors: [...errors, "invalid_summary"], value: null };
  }

  const chatId = typeof summary.chatId === "string" ? summary.chatId : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(chatId)) errors.push("invalid_chat_id");

  const participants = summary.participantUids;
  if (!Array.isArray(participants) || participants.length !== 2 ||
      participants.some(uid => typeof uid !== "string" || !uid) ||
      new Set(participants).size !== 2) {
    errors.push("invalid_participants");
  } else if (!participants.includes(authenticatedUid)) {
    errors.push("caller_not_participant");
  }

  if (!Number.isInteger(summary.unreadCount) || summary.unreadCount < 0) errors.push("invalid_unread_count");
  if (typeof summary.lastMessageSenderUid !== "string" || !summary.lastMessageSenderUid) errors.push("invalid_sender_uid");
  if (typeof summary.lastMessagePreview !== "string" || summary.lastMessagePreview.length > MAX_PREVIEW_LENGTH) {
    errors.push("invalid_preview");
  }
  if (!Number.isFinite(summary.lastMessageAtMillis) || summary.lastMessageAtMillis < 0) errors.push("invalid_message_time");
  if (!Number.isInteger(summary.schemaVersion) || summary.schemaVersion !== 1) errors.push("unsupported_schema_version");

  if (errors.length) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors: [],
    value: {
      chatId,
      participantUids: [...participants],
      unreadCount: summary.unreadCount,
      lastMessageSenderUid: summary.lastMessageSenderUid,
      lastMessagePreview: summary.lastMessagePreview,
      lastMessageAtMillis: summary.lastMessageAtMillis,
      schemaVersion: 1
    }
  };
}

export function validateInboxPageRequest({ authenticatedUid, pageSize, cursor }) {
  const errors = [];
  if (typeof authenticatedUid !== "string" || !authenticatedUid) errors.push("authentication_required");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) errors.push("invalid_page_size");
  if (cursor !== undefined && cursor !== null &&
      (typeof cursor !== "object" || Array.isArray(cursor) ||
       typeof cursor.chatId !== "string" || !cursor.chatId ||
       !Number.isFinite(cursor.lastMessageAtMillis) || cursor.lastMessageAtMillis < 0)) {
    errors.push("invalid_cursor");
  }
  return { ok: errors.length === 0, errors };
}

export const INBOX_PAGE_DEFAULT = 20;
export const INBOX_PAGE_MAX = MAX_PAGE_SIZE;
