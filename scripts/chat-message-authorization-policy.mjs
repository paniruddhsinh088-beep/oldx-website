const MESSAGE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function authorizeChatMutation({ action, actorUid, senderUid, participants, targetUid, blocked, tombstoned = false }) {
  if (typeof actorUid !== "string" || !actorUid ||
      !Array.isArray(participants) || participants.length !== 2 ||
      participants.some(uid => typeof uid !== "string" || !uid) ||
      participants[0] === participants[1] || !participants.includes(actorUid)) {
    return { ok: false, error: "not_participant" };
  }
  if (typeof senderUid !== "string" || !senderUid) return { ok: false, error: "invalid_sender" };

  if (action === "send") {
    if (senderUid !== actorUid) return { ok: false, error: "sender_mismatch" };
    if (blocked === true) return { ok: false, error: "blocked" };
    if (blocked !== false) return { ok: false, error: "block_state_unverified" };
    return { ok: true };
  }
  if (action === "delete_for_everyone") {
    if (tombstoned) return { ok: false, error: "already_tombstoned" };
    return senderUid === actorUid ? { ok: true } : { ok: false, error: "not_message_owner" };
  }
  if (action === "hide_for_self") {
    if (targetUid !== actorUid) return { ok: false, error: "cannot_change_other_visibility" };
    return { ok: true };
  }
  return { ok: false, error: "unsupported_action" };
}

export function validateChatAttachmentMetadata({ name, type, byteLength }, { allowedTypes, maxBytes }) {
  if (typeof name !== "string" || !name.trim() || name.length > 180 ||
      (name.includes("/") || name.includes("\\") || Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) return { ok: false, error: "invalid_name" };
  if (typeof type !== "string" || !Array.isArray(allowedTypes) || !allowedTypes.includes(type.toLowerCase())) {
    return { ok: false, error: "unsupported_type" };
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1 || byteLength > maxBytes) {
    return { ok: false, error: "invalid_size" };
  }
  return { ok: true };
}

export function validateImmutableMessageFields(before, after) {
  if (!before || !after) return { ok: false, error: "missing_message" };
  for (const key of ["senderUid", "createdAt", "sequence"]) {
    if (before[key] !== after[key]) return { ok: false, error: "immutable_field_changed", field: key };
  }
  return { ok: true };
}

export function validateMessageId(messageId) {
  return typeof messageId === "string" && MESSAGE_ID.test(messageId);
}
