import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderShareBundle } from "./provider-share-bundle.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ", services: ["Carpenter"]
};
const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M0 0h10v10H0z"/></svg>';

test("builds share card and QR assets for the same public profile URL", async () => {
  let encodedUrl;
  const result = await buildProviderShareBundle(profile, async url => {
    encodedUrl = url; return qrSvg;
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.qrSvg, qrSvg);
  assert.equal(result.value.profileUrl, encodedUrl);
  assert.match(result.value.cardSvg, /રમેશભાઈ/);
  assert.match(result.value.cardSvg, /worker_42/);
});

test("rejects invalid profiles before invoking QR encoder", async () => {
  let invoked = false;
  const result = await buildProviderShareBundle({ ...profile, origin: "https://evil.example" }, async () => {
    invoked = true; return qrSvg;
  });
  assert.equal(result.ok, false);
  assert.equal(invoked, false);
});

test("fails closed when QR encoder is unavailable", async () => {
  const result = await buildProviderShareBundle(profile);
  assert.equal(result.ok, false);
  assert.equal(result.code, "QR_ENCODER_UNAVAILABLE");
});

test("rejects unsafe QR SVG rather than publishing it", async () => {
  const result = await buildProviderShareBundle(profile, async () =>
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNSAFE_QR_SVG");
});
