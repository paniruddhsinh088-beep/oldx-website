/**
 * Service chat message draft validator.
 * This module does NOT write to Firestore; server-side message authorization
 * and an audited shared chat UI are prerequisites for enabling sends.
 */
const validUid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function validateServiceChatMessage({ text, senderUid, context } = {}) {
  if (!context || context.kind !== "service" ||
      !validUid(context.providerUid) || !validUid(context.buyerUid) ||
      context.providerUid === context.buyerUid ||
      context.roomId !== `service_${context.providerUid.length}_${context.providerUid}_${context.buyerUid.length}_${context.buyerUid}` ||
      ![context.providerUid,context.buyerUid].includes(senderUid)) {
    return { ok:false, error:"Invalid service chat participants." };
  }
  if (typeof text !== "string") return {ok:false,error:"Message must be text."};
  const clean = text.trim();
  if (!clean || clean.length > 2000) {
    return {ok:false,error:"Message must contain 1 to 2000 characters."};
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(clean)) {
    return {ok:false,error:"Message contains unsupported control characters."};
  }
  return {ok:true,text:clean,senderUid};
}
