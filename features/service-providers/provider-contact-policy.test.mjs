import test from "node:test";
import assert from "node:assert/strict";
import { getProviderContactOptions } from "./provider-contact-policy.mjs";

const base = {
  signedIn: true, blocked: false, isOwnProfile: false,
  providerActive: true, phoneConsent: true, hasPublicPhone: true
};

test("signed-in buyer can contact a consenting active provider", () => {
  assert.deepEqual(getProviderContactOptions(base), {
    ok: true, call: true, whatsapp: true, chat: true, reason: null
  });
});

test("phone remains private when consent or a public phone is missing", () => {
  for (const patch of [{ phoneConsent: false }, { hasPublicPhone: false }]) {
    assert.deepEqual(getProviderContactOptions({ ...base, ...patch }), {
      ok: true, call: false, whatsapp: false, chat: true, reason: "PHONE_NOT_SHARED"
    });
  }
});

test("guests cannot access contact actions", () => {
  assert.deepEqual(getProviderContactOptions({ ...base, signedIn: false }), {
    ok: true, call: false, whatsapp: false, chat: false, reason: "SIGN_IN_REQUIRED"
  });
});

test("blocked, own and inactive profiles cannot be contacted", () => {
  for (const patch of [{ blocked: true }, { isOwnProfile: true }, { providerActive: false }]) {
    assert.deepEqual(getProviderContactOptions({ ...base, ...patch }), {
      ok: true, call: false, whatsapp: false, chat: false, reason: "UNAVAILABLE"
    });
  }
});

test("missing or malformed security context fails closed", () => {
  for (const context of [undefined, { ...base, blocked: "false" }, { ...base, signedIn: null }]) {
    assert.deepEqual(getProviderContactOptions(context), {
      ok: false, code: "INVALID_CONTACT_CONTEXT"
    });
  }
});
