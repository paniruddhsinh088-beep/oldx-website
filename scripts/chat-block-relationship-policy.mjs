export function authorizeBlockRelationship({ actorUid, blockerUid, blockedUid, action }) {
  if (typeof actorUid !== "string" || !actorUid ||
      typeof blockerUid !== "string" || !blockerUid ||
      typeof blockedUid !== "string" || !blockedUid ||
      blockerUid === blockedUid) {
    return { ok: false, error: "invalid_relationship" };
  }
  if (actorUid !== blockerUid) return { ok: false, error: "not_block_owner" };
  if (action !== "block" && action !== "unblock") return { ok: false, error: "unsupported_action" };
  return { ok: true };
}

export function authorizeMessageAgainstBlock({ senderUid, recipientUid, chatParticipants, blockedByRecipient }) {
  if (typeof senderUid !== "string" || !senderUid ||
      typeof recipientUid !== "string" || !recipientUid ||
      senderUid === recipientUid ||
      !Array.isArray(chatParticipants) ||
      chatParticipants.length !== 2 ||
      new Set(chatParticipants).size !== 2 ||
      !chatParticipants.includes(senderUid) ||
      !chatParticipants.includes(recipientUid)) {
    return { ok: false, error: "invalid_chat_membership" };
  }
  if (blockedByRecipient === true) return { ok: false, error: "blocked_by_recipient" };
  if (blockedByRecipient !== false) return { ok: false, error: "block_state_unverified" };
  return { ok: true };
}

export function deriveOtherChatParticipant({ actorUid, participants }) {
  if (typeof actorUid !== "string" || !actorUid ||
      !Array.isArray(participants) ||
      participants.length !== 2 ||
      participants.some(uid => typeof uid !== "string" || !uid) ||
      participants[0] === participants[1] ||
      !participants.includes(actorUid)) {
    return { ok: false, error: "invalid_chat_membership" };
  }
  return { ok: true, otherUid: participants[0] === actorUid ? participants[1] : participants[0] };
}

export function authorizeChatCreation({ actorUid, buyerUid, sellerUid, productId, participants }) {
  if (typeof actorUid !== "string" || !actorUid ||
      typeof buyerUid !== "string" || !buyerUid ||
      typeof sellerUid !== "string" || !sellerUid ||
      typeof productId !== "string" || !productId ||
      buyerUid === sellerUid ||
      actorUid !== buyerUid ||
      !Array.isArray(participants) ||
      participants.length !== 2 ||
      new Set(participants).size !== 2 ||
      !participants.includes(buyerUid) ||
      !participants.includes(sellerUid)) {
    return { ok: false, error: "invalid_chat_creation" };
  }
  return { ok: true };
}
