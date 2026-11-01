import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { buildProviderQrPayload } from "./provider-qr-payload.mjs";

const provider = {
  origin: "https://oldxbazar.in",
  providerId: "worker_42",
  displayName: "રમેશભાઈ",
  city: "અમદાવાદ",
  services: ["Carpenter"]
};

test("offline QR matrix encodes the exact approved public profile URL", () => {
  const payload = buildProviderQrPayload(provider);
  assert.equal(payload.ok, true);
  const qr = QRCode.create(payload.value.text, { errorCorrectionLevel: "M" });
  assert.equal(qr.errorCorrectionLevel.bit, 0);
  assert.equal(qr.modules.size > 20, true);
  assert.equal(qr.modules.size % 4, 1);
  assert.equal(qr.modules.data.length, qr.modules.size ** 2);
  assert.ok(qr.modules.data.some(bit => bit === 1));
  assert.ok(qr.modules.data.some(bit => bit === 0));
  assert.equal(payload.value.text, "https://oldxbazar.in/services/provider/worker_42");
});

test("QR payload rejects attacker-controlled host before encoding", () => {
  const result = buildProviderQrPayload({ ...provider, origin: "https://example.com" });
  assert.equal(result.ok, false);
});
