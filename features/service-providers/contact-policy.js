/**
 * OLDX service provider contact policy.
 *
 * UI checks only; existing OLDX auth, chat blocking and Firestore rules must
 * enforce the same policy. No phone number or WhatsApp URL is exposed here.
 */
const validUid = value => typeof value === "string" && value.trim().length > 0;

export function getServiceContactPermissions({
  viewerUid = null,
  providerUid = null,
  blockedByViewer = false,
  blockedByProvider = false,
  providerStatus = "pending"
} = {}) {
  const active = providerStatus === "active";
  const authenticated = validUid(viewerUid);
  const validProvider = validUid(providerUid);
  const ownProfile = authenticated && validProvider && viewerUid === providerUid;
  const blocked = blockedByViewer === true || blockedByProvider === true;
  const allowed = active && authenticated && validProvider && !ownProfile && !blocked;
  return {
    canChat: allowed,
    canWhatsApp: allowed,
    canCall: active && validProvider && !ownProfile && !blocked,
    requiresSignIn: active && !authenticated,
    reason: !active ? "This provider is unavailable."
      : !validProvider ? "Provider account unavailable."
      : ownProfile ? "You cannot contact your own profile."
      : blocked ? "Contact is unavailable for this conversation."
      : !authenticated ? "Sign in to chat or use WhatsApp."
      : ""
  };
}

/**
 * Invoke this at the moment of interaction, not only at render time.
 * Resolver is expected to refresh auth and block state in the host app.
 */
export async function requestServiceContact({ action, resolvePermissions, onAllowed }) {
  if (!["chat", "whatsapp", "call"].includes(action)) {
    throw new TypeError("Unsupported contact action");
  }
  if (typeof resolvePermissions !== "function" || typeof onAllowed !== "function") {
    throw new TypeError("Permission resolver and action handler are required");
  }
  const permissions = getServiceContactPermissions(await resolvePermissions());
  const key = { chat: "canChat", whatsapp: "canWhatsApp", call: "canCall" }[action];
  if (!permissions[key]) {
    return { allowed: false, reason: permissions.reason || "Contact unavailable." };
  }
  await onAllowed();
  return { allowed: true, reason: "" };
}
