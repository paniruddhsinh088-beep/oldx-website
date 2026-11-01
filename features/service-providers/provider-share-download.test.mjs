import test from "node:test";
import assert from "node:assert/strict";
import { prepareProviderShareDownloads } from "./provider-share-download.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ", services: ["Carpenter"]
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M0 0h10v10H0z"/></svg>';

test("prepares both offline SVG files with stable filenames", async () => {
  const result = await prepareProviderShareDownloads(profile, async () => svg);
  assert.equal(result.ok, true);
  assert.equal(result.value.files.length, 2);
  assert.deepEqual(result.value.files.map(file => file.filename), [
    "oldx-provider-worker_42-card.svg", "oldx-provider-worker_42-qr.svg"
  ]);
  assert.equal(result.value.files[1].content, svg);
  assert.equal(result.value.profileUrl, "https://oldxbazar.in/services/provider/worker_42");
});

test("rejects invalid provider IDs before creating filenames", async () => {
  const result = await prepareProviderShareDownloads({ ...profile, providerId: "../admin" }, async () => svg);
  assert.equal(result.ok, false);
});

test("does not claim downloads are ready without QR encoder", async () => {
  const result = await prepareProviderShareDownloads(profile);
  assert.deepEqual(result, { ok: false, code: "QR_ENCODER_UNAVAILABLE" });
});

test("does not expose private contact information in downloadable SVG", async () => {
  const result = await prepareProviderShareDownloads({
    ...profile, phone: "SECRET_PHONE", ownerUid: "SECRET_UID"
  }, async () => svg);
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.value.files.map(file => file.content).join(""), /SECRET_PHONE|SECRET_UID/);
});
