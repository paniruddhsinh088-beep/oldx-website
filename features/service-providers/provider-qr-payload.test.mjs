import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderQrPayload } from "./provider-qr-payload.mjs";

const profile = {
  origin: "https://oldxbazar.in",
  providerId: "worker_42",
  displayName: "રમેશભાઈ",
  city: "અમદાવાદ",
  services: ["Carpenter", "Electrician"]
};

test("produces a stable QR payload with the public profile URL only", () => {
  assert.deepEqual(buildProviderQrPayload(profile), {
    ok: true,
    value: {
      text: "https://oldxbazar.in/services/provider/worker_42",
      format: "url",
      errorCorrectionLevel: "M",
      caption: "Scan to view OLDX service provider"
    }
  });
});

test("rejects foreign and insecure QR targets", () => {
  for (const origin of ["https://evil.example", "http://oldxbazar.in", "javascript:alert(1)"]) {
    assert.equal(buildProviderQrPayload({ ...profile, origin }).ok, false);
  }
});

test("rejects malicious or malformed provider identifiers", () => {
  for (const providerId of ["../admin", "foo/bar", "", "a".repeat(101)]) {
    assert.equal(buildProviderQrPayload({ ...profile, providerId }).ok, false);
  }
});

test("never includes private contact or identity details in QR payload", () => {
  const result = buildProviderQrPayload({
    ...profile, phone: "SECRET_PHONE", email: "SECRET_EMAIL", ownerUid: "SECRET_UID"
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result.value), /SECRET_PHONE|SECRET_EMAIL|SECRET_UID/);
});
