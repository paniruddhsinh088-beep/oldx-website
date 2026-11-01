import test from "node:test";
import assert from "node:assert/strict";
import { encodeProviderQrSvg } from "./provider-qr-encoder.mjs";

const url = "https://oldxbazar.in/services/provider/worker_42";

test("passes approved OLDX URL to offline QR library", async () => {
  let seen;
  const svg = await encodeProviderQrSvg(url, {}, async () => ({
    toString: async (text, options) => {
      seen = { text, options };
      return '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h5"/></svg>';
    }
  }));
  assert.match(svg, /^<svg /);
  assert.equal(seen.text, url);
  assert.equal(seen.options.type, "svg");
  assert.equal(seen.options.margin, 2);
});

test("rejects external and non-profile links before loading package", async () => {
  for (const bad of [
    "https://evil.example/services/provider/worker_42",
    "http://oldxbazar.in/services/provider/worker_42",
    "https://oldxbazar.in/admin",
    "https://oldxbazar.in/services/provider/../admin"
  ]) {
    let loaded = false;
    await assert.rejects(() => encodeProviderQrSvg(bad, {}, async () => {
      loaded = true;
      return { toString: async () => "unused" };
    }), TypeError);
    assert.equal(loaded, false);
  }
});

test("fails when QR package does not export an encoder", async () => {
  await assert.rejects(() => encodeProviderQrSvg(url, {}, async () => ({})), TypeError);
});

test("caller cannot override safe QR options", async () => {
  let options;
  await encodeProviderQrSvg(url, { type: "png", margin: 0 }, async () => ({
    toString: async (_url, opts) => { options = opts; return "<svg/>"; }
  }));
  assert.equal(options.type, "svg");
  assert.equal(options.margin, 2);
});
