import test from "node:test";
import assert from "node:assert/strict";
import { downloadProviderCardAndQr } from "./provider-qr-download-entry.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ", services: ["Carpenter"]
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M0 0h10v10H0z"/></svg>';

test("connects QR encoder to card and QR browser downloads", async () => {
  const downloaded = [];
  const released = [];
  const browser = {
    Blob: class { constructor(parts, options) { this.parts = parts; this.type = options.type; } },
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: url => released.push(url)
    },
    document: {
      body: { appendChild: () => {} },
      createElement: () => ({
        style: {},
        set download(name) { downloaded.push(name); },
        click: () => {},
        remove: () => {}
      })
    }
  };
  const result = await downloadProviderCardAndQr(profile, browser, async () => svg);
  assert.equal(result.ok, true);
  assert.equal(result.downloaded, 2);
  assert.deepEqual(downloaded, [
    "oldx-provider-worker_42-card.svg",
    "oldx-provider-worker_42-qr.svg"
  ]);
  assert.equal(released.length, 2);
});

test("fails safely without browser support", async () => {
  const result = await downloadProviderCardAndQr(profile, {}, async () => svg);
  assert.equal(result.code, "BROWSER_APIS_UNAVAILABLE");
});
