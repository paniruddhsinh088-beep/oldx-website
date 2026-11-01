const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SERVER_OWNED_STATE_FIELDS = new Set(["unreadCount", "lastReadAt", "updatedAt", "lastReadSequence"]);
const ALLOWED_CLIENT_INTENTS = new Set(["request_read_through", "hide_message", "unhide_message", "set_typing"]);

function validUid(value) {
  return typeof value === "string" && UID_PATTERN.test(value);
}

function validParticipants(participants) {
  return Array.isArray(participants) &&
    participants.length === 2 &&
    participants.every(validUid) &&
    participants[0] !== participants[1];
}

export function authorizePrivateChatStateAccess({
  verifiedUid,
  pathUid,
  participants,
  operation
}) {
  if (!validUid(verifiedUid) || !validUid(pathUid) ||
      !validParticipants(participants) ||
      !participants.includes(verifiedUid) ||
      pathUid !== verifiedUid) {
    return { ok: false, code: "FORBIDDEN" };
  }
  if (!["read", "request_update"].includes(operation)) {
    return { ok: false, code: "UNSUPPORTED_OPERATION" };
  }
  return { ok: true, ownerUid: verifiedUid };
}

export function validatePrivateChatStateIntent({
  verifiedUid,
  pathUid,
  participants,
  intent,
  payload,
  latestSequence
}) {
  const access = authorizePrivateChatStateAccess({
    verifiedUid, pathUid, participants, operation: "request_update"
  });
  if (!access.ok) return access;
  if (!ALLOWED_CLIENT_INTENTS.has(intent)) {
    return { ok: false, code: "UNSUPPORTED_INTENT" };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, code: "INVALID_PAYLOAD" };
  }
  if (Object.keys(payload).some(key => SERVER_OWNED_STATE_FIELDS.has(key) ||
      !["messageId", "sequence", "active"].includes(key))) {
    return { ok: false, code: "SERVER_FIELD_OR_UNKNOWN_FIELD" };
  }
  if (intent === "request_read_through") {
    if (Object.keys(payload).some(key => !["messageId", "sequence"].includes(key)) ||
        !validUid(payload.messageId) ||
        !Number.isSafeInteger(payload.sequence) || payload.sequence < 1 ||
        !Number.isSafeInteger(latestSequence) || latestSequence < 0 ||
        payload.sequence > latestSequence) {
      return { ok: false, code: "INVALID_READ_CURSOR_REQUEST" };
    }
  } else if (intent === "hide_message" || intent === "unhide_message") {
    if (Object.keys(payload).length !== 1 || !validUid(payload.messageId)) {
      return { ok: false, code: "INVALID_HIDDEN_MESSAGE_REQUEST" };
    }
  } else if (intent === "set_typing") {
    if (Object.keys(payload).length !== 1 || typeof payload.active !== "boolean") {
      return { ok: false, code: "INVALID_TYPING_REQUEST" };
    }
  }
  return { ok: true, ownerUid: verifiedUid, intent };
}

export function advancePrivateReadCursor(currentSequence, requestedSequence, latestSequence) {
  if (!Number.isSafeInteger(currentSequence) || currentSequence < 0 ||
      !Number.isSafeInteger(requestedSequence) || requestedSequence < 1 ||
      !Number.isSafeInteger(latestSequence) || latestSequence < 0 ||
      requestedSequence > latestSequence) {
    return { ok: false, code: "INVALID_READ_CURSOR" };
  }
  return {
    ok: true,
    sequence: Math.max(currentSequence, requestedSequence),
    changed: requestedSequence > currentSequence
  };
}
