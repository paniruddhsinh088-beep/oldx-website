const MAX_PAGE_SIZE = 30;

export function authorizeChatRead({ verifiedUid, participants, hiddenFor = [], deletedForEveryone = false }) {
  if (typeof verifiedUid !== "string" || !verifiedUid ||
      !Array.isArray(participants) || !participants.includes(verifiedUid)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  if (!Array.isArray(hiddenFor) || hiddenFor.some(uid => typeof uid !== "string")) {
    return { ok: false, code: "INVALID_VISIBILITY_STATE" };
  }
  if (deletedForEveryone === true || hiddenFor.includes(verifiedUid)) {
    return { ok: true, visible: false };
  }
  return { ok: true, visible: true };
}

export function authorizeChatSend({ verifiedUid, senderUid, recipientUid, participants, blockEdges = [] }) {
  if (typeof verifiedUid !== "string" || !verifiedUid ||
      verifiedUid !== senderUid || typeof recipientUid !== "string" ||
      recipientUid === senderUid || !Array.isArray(participants) ||
      !participants.includes(senderUid) || !participants.includes(recipientUid)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  if (!Array.isArray(blockEdges) || blockEdges.some(edge =>
    !edge || typeof edge.blockerUid !== "string" || typeof edge.blockedUid !== "string"
  )) return { ok: false, code: "INVALID_BLOCK_STATE" };
  const blocked = blockEdges.some(edge =>
    (edge.blockerUid === senderUid && edge.blockedUid === recipientUid) ||
    (edge.blockerUid === recipientUid && edge.blockedUid === senderUid)
  );
  return blocked ? { ok: false, code: "BLOCKED" } : { ok: true };
}

export function authorizeBlockChange({ verifiedUid, ownerUid, targetUid }) {
  if (typeof verifiedUid !== "string" || !verifiedUid ||
      verifiedUid !== ownerUid || typeof targetUid !== "string" ||
      !targetUid || targetUid === verifiedUid) {
    return { ok: false, code: "FORBIDDEN" };
  }
  return { ok: true };
}

export function validateChatPage({ pageSize = 20, cursor = null } = {}) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return { ok: false, code: "INVALID_PAGE_SIZE" };
  }
  if (cursor !== null && (typeof cursor !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(cursor))) {
    return { ok: false, code: "INVALID_CURSOR" };
  }
  return { ok: true, pageSize, cursor };
}

export function sanitizeChatSummary(summary, verifiedUid) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary) ||
      typeof verifiedUid !== "string" || !verifiedUid ||
      !Array.isArray(summary.participants) || !summary.participants.includes(verifiedUid)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  const { participants, lastMessagePreview, unreadCount, updatedAt } = summary;
  if (!Number.isSafeInteger(unreadCount) || unreadCount < 0) {
    return { ok: false, code: "INVALID_SUMMARY" };
  }
  return {
    ok: true,
    summary: {
      participants: participants.filter(uid => uid !== verifiedUid),
      lastMessagePreview: typeof lastMessagePreview === "string" ? lastMessagePreview.slice(0, 120) : "",
      unreadCount,
      updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    },
  };
}
