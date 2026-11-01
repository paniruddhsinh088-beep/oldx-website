import test from "node:test";
import assert from "node:assert/strict";
import { encodeProviderQrSvg } from "./provider-qr-encoder.mjs";
import { renderProviderQrSvg } from "./provider-qr-svg.mjs";
import { buildProviderShareBundle } from "./provider-share-bundle.mjs";

const profile = {
  origin: "https://oldxbazar.in",
  providerId: "worker_42",
  displayName: "રમેશભાઈ",
  city: "અમદાવાદ",
  services: ["Carpenter"]
};
const url = "https://oldxbazar.in/services/provider/worker_42";

// Integration tests require npm install (qrcode@1.5.4).
// Do not replace with mocks: these tests must exercise the actual encoder.
test("real offline QR library generates safe SVG accepted by renderer", async () => {
  const svg = await encodeProviderQrSvg(url);
  assert.match(svg, /<svg\b/);
  const result = await renderProviderQrSvg(profile, encodeProviderQrSvg);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.url, url);
  assert.match(result.value.svg, /<path\b/);
});

test("real QR encoder integrates with public share card bundle", async () => {
  const result = await buildProviderShareBundle(profile, encodeProviderQrSvg);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.profileUrl, url);
  assert.match(result.value.cardSvg, /રમેશભાઈ/);
  assert.match(result.value.qrSvg, /<path\b/);
});
