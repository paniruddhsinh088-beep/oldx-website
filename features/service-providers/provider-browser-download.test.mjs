import test from "node:test";
import assert from "node:assert/strict";
import { downloadProviderShareAssets } from "./provider-browser-download.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ", services: ["Carpenter"]
};
const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M0 0h10v10H0z"/></svg>';

function mockBrowser() {
  const events = [];
  return {
    events,
    createBlob: (content, type) => ({ content, type }),
    createObjectURL: () => { events.push("create"); return "blob:mock"; },
    revokeObjectURL: url => events.push("revoke:" + url),
    download: async (url, filename) => events.push("download:" + filename)
  };
}

test("downloads both SVG assets and releases temporary URLs", async () => {
  const browser = mockBrowser();
  const result = await downloadProviderShareAssets(profile, async () => qrSvg, browser);
  assert.equal(result.ok, true);
  assert.equal(result.downloaded, 2);
  assert.equal(browser.events.filter(e => e === "create").length, 2);
  assert.equal(browser.events.filter(e => e === "revoke:blob:mock").length, 2);
  assert.equal(browser.events.filter(e => e.startsWith("download:")).length, 2);
});

test("fails closed if browser download capabilities are missing", async () => {
  assert.deepEqual(await downloadProviderShareAssets(profile, async () => qrSvg), {
    ok: false, code: "DOWNLOAD_UNAVAILABLE"
  });
});

test("does not download if QR encoder is missing", async () => {
  const browser = mockBrowser();
  const result = await downloadProviderShareAssets(profile, undefined, browser);
  assert.equal(result.code, "QR_ENCODER_UNAVAILABLE");
  assert.deepEqual(browser.events, []);
});

test("releases object URL even if download fails", async () => {
  const browser = mockBrowser();
  browser.download = async () => { throw Error("blocked"); };
  const result = await downloadProviderShareAssets(profile, async () => qrSvg, browser);
  assert.equal(result.ok, false);
  assert.equal(result.code, "DOWNLOAD_FAILED");
  assert.equal(result.downloaded, 0);
  assert.deepEqual(browser.events, ["create", "revoke:blob:mock"]);
});
