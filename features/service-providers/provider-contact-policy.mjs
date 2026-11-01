/**
 * Review-only contact decision helper. No phone number, URL, or Firebase access.
 * The actual chat backend MUST separately enforce auth, blocks and ownership.
 * A provider's consent to publish a phone number must be checked server-side.
 */
export function getProviderContactOptions({
  signedIn,
  blocked,
  isOwnProfile,
  providerActive,
  phoneConsent,
  hasPublicPhone
} = {}) {
  if ([signedIn, blocked, isOwnProfile, providerActive, phoneConsent, hasPublicPhone]
      .some(value => typeof value !== "boolean")) {
    return { ok: false, code: "INVALID_CONTACT_CONTEXT" };
  }
  if (!providerActive || blocked || isOwnProfile) {
    return { ok: true, call: false, whatsapp: false, chat: false, reason: "UNAVAILABLE" };
  }
  if (!signedIn) {
    return { ok: true, call: false, whatsapp: false, chat: false, reason: "SIGN_IN_REQUIRED" };
  }
  const phoneAllowed = phoneConsent && hasPublicPhone;
  return {
    ok: true,
    call: phoneAllowed,
    whatsapp: phoneAllowed,
    chat: true,
    reason: phoneAllowed ? null : "PHONE_NOT_SHARED"
  };
}
