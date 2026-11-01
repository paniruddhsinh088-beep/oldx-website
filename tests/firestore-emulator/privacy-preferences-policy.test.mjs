import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePreferences,
  validatePreferencePatch,
  applyPreferencePatch,
  validateConsentRequest,
  isConsentActiveForScope,
} from "../../scripts/privacy-preferences-policy.mjs";

test("missing or malformed preferences resolve to privacy-safe defaults", () => {
  const expected = {
    schemaVersion: 1,
    contact: { phoneVisibility: "private", whatsappVisibility: "private" },
    location: { publicDisplay: "hidden", exactLocationSharing: "private" },
    presence: { onlineVisibility: "hidden", lastSeenVisibility: "hidden" },
    notifications: { messagePreview: "generic" },
  };
  assert.deepEqual(normalizePreferences(null), expected);
  assert.deepEqual(normalizePreferences({ contact: { phoneVisibility: "public" } }), expected);
});

test("normalization ignores unknown and unsafe preference values", () => {
  const value = normalizePreferences({
    contact: { phoneVisibility: "selectedListings", admin: true },
    location: { exactLocationSharing: "enabled" },
    isAdmin: true,
    schemaVersion: 999,
  });
  assert.equal(value.contact.phoneVisibility, "selectedListings");
  assert.equal(value.location.exactLocationSharing, "private");
  assert.equal("isAdmin" in value, false);
  assert.equal(value.schemaVersion, 1);
});

test("patch accepts only explicit allow-listed fields and values", () => {
  assert.deepEqual(validatePreferencePatch({ "contact.phoneVisibility": "private" }), {
    ok: true, values: { "contact.phoneVisibility": "private" },
  });
  for (const patch of [
    null,
    {},
    { uid: "victim" },
    { isAdmin: true },
    { "contact.phoneVisibility": "public" },
    { "location.exactLocationSharing": true },
    { "contact.phoneVisibility": "private", uid: "victim" },
  ]) assert.equal(validatePreferencePatch(patch).ok, false);
});

test("patch changes only requested fields and preserves safe defaults", () => {
  const result = applyPreferencePatch({}, {
    "contact.phoneVisibility": "selectedListings",
    "notifications.messagePreview": "generic",
  });
  assert.equal(result.ok, true);
  assert.equal(result.preferences.contact.phoneVisibility, "selectedListings");
  assert.equal(result.preferences.contact.whatsappVisibility, "private");
  assert.equal(result.preferences.location.exactLocationSharing, "private");
});

test("consent request requires exact purpose, field, scope, and version", () => {
  const valid = {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_123", policyVersion: "v1",
  };
  assert.equal(validateConsentRequest(valid).ok, true);
  for (const invalid of [
    { ...valid, field: "exactLocation" },
    { ...valid, scopeId: "../other-user" },
    { ...valid, policyVersion: "latest" },
    { ...valid, uid: "attacker", scopeType: "all" },
    { ...valid, purpose: "adminOverride" },
  ]) assert.equal(validateConsentRequest(invalid).ok, false);
});

test("consent for another scope, field, purpose, or policy version never authorizes disclosure", () => {
  const expected = {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_A", policyVersion: "v1",
  };
  const active = { ...expected, status: "active", revokedAt: null };
  assert.equal(isConsentActiveForScope([active], expected), true);
  assert.equal(isConsentActiveForScope([{ ...active, scopeId: "listing_B" }], expected), false);
  assert.equal(isConsentActiveForScope([{ ...active, field: "whatsapp" }], expected), false);
  assert.equal(isConsentActiveForScope([{ ...active, policyVersion: "v2" }], expected), false);
});

test("revoked consent does not authorize disclosure even if another active record exists for different scope", () => {
  const expected = {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_A", policyVersion: "v1",
  };
  assert.equal(isConsentActiveForScope([
    { ...expected, status: "revoked", revokedAt: "server-time" },
    { ...expected, status: "active", revokedAt: null, scopeId: "listing_B" },
  ], expected), false);
});

test("malformed consent collections fail closed", () => {
  assert.equal(isConsentActiveForScope(null, {}), false);
  assert.equal(isConsentActiveForScope([null, {}], {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_A", policyVersion: "v1",
  }), false);
});

test("only the verified owner may revoke their own consent", async () => {
  const { revokeConsent } = await import("../../scripts/privacy-preferences-policy.mjs");
  const consent = {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_A", policyVersion: "v1", status: "active", revokedAt: null,
  };
  assert.equal(revokeConsent(consent, "user_A", "user_A", "server-time").ok, true);
  assert.deepEqual(revokeConsent(consent, "user_B", "user_A", "server-time"), {
    ok: false, code: "FORBIDDEN",
  });
  assert.deepEqual(revokeConsent(consent, "", "user_A", "server-time"), {
    ok: false, code: "FORBIDDEN",
  });
});

test("revocation is idempotently blocked after the first successful revoke", async () => {
  const { revokeConsent, isConsentActiveForScope } = await import("../../scripts/privacy-preferences-policy.mjs");
  const consent = {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_A", policyVersion: "v1", status: "active", revokedAt: null,
  };
  const revoked = revokeConsent(consent, "user_A", "user_A", "server-time");
  assert.equal(revoked.ok, true);
  assert.equal(revokeConsent(revoked.consent, "user_A", "user_A", "later-time").code, "CONFLICT");
  assert.equal(isConsentActiveForScope([revoked.consent], consent), false);
});

test("missing authoritative server timestamp fails closed during revocation", async () => {
  const { revokeConsent } = await import("../../scripts/privacy-preferences-policy.mjs");
  const consent = { status: "active", revokedAt: null };
  assert.deepEqual(revokeConsent(consent, "user_A", "user_A", null), {
    ok: false, code: "UNAVAILABLE",
  });
});

test("private-field disclosure requires owner, active account, moderation approval, and exact active consent", async () => {
  const { canDisclosePrivateField } = await import("../../scripts/privacy-preferences-policy.mjs");
  const expectedConsent = {
    purpose: "displayContact", field: "phone", scopeType: "listing",
    scopeId: "listing_A", policyVersion: "v1",
  };
  const consents = [{
    ...expectedConsent, status: "active", revokedAt: null,
  }];
  const base = {
    verifiedUid: "user_A", resourceOwnerUid: "user_A", consents,
    expectedConsent, accountActive: true, moderationAllows: true,
  };
  assert.equal(canDisclosePrivateField(base), true);
  assert.equal(canDisclosePrivateField({ ...base, verifiedUid: "user_B" }), false);
  assert.equal(canDisclosePrivateField({ ...base, accountActive: false }), false);
  assert.equal(canDisclosePrivateField({ ...base, moderationAllows: false }), false);
  assert.equal(canDisclosePrivateField({ ...base, consents: [] }), false);
  assert.equal(canDisclosePrivateField({ ...base, consents: [{
    ...consents[0], status: "revoked", revokedAt: "server-time",
  }] }), false);
});
