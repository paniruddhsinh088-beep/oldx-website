/**
 * Chat context builder for OLDX service providers.
 * Uses existing chats/{roomId}/messages, without altering legacy product IDs.
 * IMPORTANT: this is metadata construction only. Firestore authorization rules
 * and existing chat UI must be audited before any service chat write is enabled.
 */
const uid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function buildServiceChatContext({ providerUid, buyerUid } = {}) {
  if (!uid(providerUid) || !uid(buyerUid)) throw new TypeError("Invalid chat participant");
  if (providerUid === buyerUid) throw new TypeError("Cannot start a chat with yourself");
  // Prefix and explicit delimiter distinguish service rooms from product rooms.
  // Firebase IDs cannot contain '/', and this encoding cannot collide between
  // different (provider,buyer) pairs due to length-prefixing.
  const roomId = `service_${providerUid.length}_${providerUid}_${buyerUid.length}_${buyerUid}`;
  if (roomId.length > 1500) throw new RangeError("Chat room ID too long");
  return Object.freeze({
    kind: "service",
    roomId,
    providerUid,
    buyerUid,
    participants: Object.freeze([buyerUid, providerUid]),
    serviceProviderId: providerUid
  });
}
export function buildServiceChatCreateData(context) {
  if (!context || context.kind !== "service" ||
      context.roomId !== buildServiceChatContext(context).roomId) {
    throw new TypeError("Invalid service chat context");
  }
  const canonical = buildServiceChatContext(context);
  return {
    participants: [...canonical.participants],
    serviceProviderId: canonical.providerUid,
    chatType: "service"
  };
}
