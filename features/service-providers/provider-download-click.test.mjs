import test from "node:test";
import assert from "node:assert/strict";
import { handleProviderShareDownloadClick } from "./provider-download-click.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ", services: ["Carpenter"]
};
const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M0 0h10v10H0z"/></svg>';

function fakeBrowser() {
  const calls = [];
  return {
    calls,
    Blob: class { constructor(parts, options) { this.parts = parts; this.type = options.type; } },
    URL: {
      createObjectURL: () => { calls.push("create"); return "blob:fake"; },
      revokeObjectURL: () => calls.push("revoke")
    },
    document: {
      body: { appendChild: () => calls.push("append") },
      createElement: () => ({
        style: {},
        click: () => calls.push("click"),
        remove: () => calls.push("remove")
      })
    }
  };
}

test("browser click downloads two SVG files and releases object URLs", async () => {
  const env = fakeBrowser();
  const result = await handleProviderShareDownloadClick(profile, async () => qrSvg, env);
  assert.equal(result.ok, true);
  assert.equal(result.downloaded, 2);
  assert.equal(env.calls.filter(c => c === "click").length, 2);
  assert.equal(env.calls.filter(c => c === "remove").length, 2);
  assert.equal(env.calls.filter(c => c === "revoke").length, 2);
});

test("missing browser APIs fail closed", async () => {
  assert.deepEqual(await handleProviderShareDownloadClick(profile, async () => qrSvg, {}), {
    ok: false, code: "BROWSER_APIS_UNAVAILABLE"
  });
});

test("no download happens if QR encoder is unavailable", async () => {
  const env = fakeBrowser();
  const result = await handleProviderShareDownloadClick(profile, undefined, env);
  assert.equal(result.code, "QR_ENCODER_UNAVAILABLE");
  assert.deepEqual(env.calls, []);
});

test("link is removed and temporary URL revoked when click throws", async () => {
  const env = fakeBrowser();
  env.document.createElement = () => ({
    style: {}, click: () => { throw new Error("blocked"); },
    remove: () => env.calls.push("remove")
  });
  const result = await handleProviderShareDownloadClick(profile, async () => qrSvg, env);
  assert.equal(result.code, "DOWNLOAD_FAILED");
  assert.deepEqual(env.calls, ["create", "append", "remove", "revoke"]);
});
