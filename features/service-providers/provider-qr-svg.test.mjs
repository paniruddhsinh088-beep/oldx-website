import test from "node:test";
import assert from "node:assert/strict";
import { renderProviderQrSvg } from "./provider-qr-svg.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ", services: ["Carpenter"]
};
const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M0 0h10v10H0z"/></svg>';

test("passes trusted OLDX URL to offline QR encoder", async () => {
  let received;
  const result = await renderProviderQrSvg(profile, async (url, options) => {
    received = { url, options };
    return safeSvg;
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.svg, safeSvg);
  assert.equal(received.url, "https://oldxbazar.in/services/provider/worker_42");
  assert.equal(received.options.type, "svg");
});

test("fails closed when encoder is unavailable or throws", async () => {
  assert.equal((await renderProviderQrSvg(profile)).code, "QR_ENCODER_UNAVAILABLE");
  assert.equal((await renderProviderQrSvg(profile, async () => { throw Error("failure"); })).code, "QR_ENCODING_FAILED");
});

test("rejects malicious SVG returned by encoder", async () => {
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/a"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://evil.example">link</a></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example)</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="x" values="0;1"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" style="fill:url(https://evil.example)"/></svg>',
    "not an svg"
  ]) {
    assert.equal((await renderProviderQrSvg(profile, async () => svg)).code, "UNSAFE_QR_SVG");
  }
});

test("does not invoke encoder for invalid or foreign URLs", async () => {
  let called = false;
  const result = await renderProviderQrSvg({ ...profile, origin: "https://evil.example" }, async () => {
    called = true; return safeSvg;
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});
