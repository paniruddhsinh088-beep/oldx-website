export function advanceReadCursor(currentSequence, requestedSequence) {
  if (!Number.isSafeInteger(currentSequence) || currentSequence < 0 ||
      !Number.isSafeInteger(requestedSequence) || requestedSequence < 1) {
    return { ok: false, error: "invalid_sequence", sequence: currentSequence };
  }
  return { ok: true, sequence: Math.max(currentSequence, requestedSequence), changed: requestedSequence > currentSequence };
}

export function applySyntheticUnreadEvent({ unreadCount, senderUid, recipientUid, eventId, processedEventIds }) {
  if (!Number.isSafeInteger(unreadCount) || unreadCount < 0) return { ok: false, error: "invalid_unread_count" };
  if (typeof senderUid !== "string" || !senderUid || typeof recipientUid !== "string" || !recipientUid || senderUid === recipientUid) {
    return { ok: false, error: "invalid_participants" };
  }
  if (typeof eventId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(eventId)) return { ok: false, error: "invalid_event_id" };
  if (!Array.isArray(processedEventIds) || processedEventIds.some(id => typeof id !== "string")) {
    return { ok: false, error: "invalid_processed_events" };
  }
  if (processedEventIds.includes(eventId)) return { ok: true, unreadCount, duplicate: true };
  return { ok: true, unreadCount: unreadCount + 1, duplicate: false };
}
