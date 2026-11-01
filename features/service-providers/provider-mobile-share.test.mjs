import test from "node:test";
import assert from "node:assert/strict";
import { shareProviderProfile } from "./provider-mobile-share.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "provider_123",
  displayName: "કિરણભાઈ", city: "અમદાવાદ", services: ["Carpenter", "Painter"]
};
const url = "https://oldxbazar.in/services/provider/provider_123";

test("uses native mobile share with title, text and safe URL", async () => {
  let payload;
  const result = await shareProviderProfile(profile, {
    share: async data => { payload = data; },
    writeText: async () => { throw Error("should not copy"); }
  });
  assert.deepEqual(result, { ok: true, method: "native" });
  assert.equal(payload.url, url);
  assert.equal(payload.title, "કિરણભાઈ | OLDX Services");
});

test("falls back to clipboard when native sharing is unavailable", async () => {
  let copied;
  const result = await shareProviderProfile(profile, {
    writeText: async value => { copied = value; }
  });
  assert.deepEqual(result, { ok: true, method: "clipboard" });
  assert.equal(copied, url);
});

test("does not copy link after user cancels native share", async () => {
  let copied = false;
  const result = await shareProviderProfile(profile, {
    share: async () => { const e = new Error("cancel"); e.name = "AbortError"; throw e; },
    writeText: async () => { copied = true; }
  });
  assert.deepEqual(result, { ok: false, code: "SHARE_CANCELLED" });
  assert.equal(copied, false);
});

test("handles missing share capabilities and invalid profile", async () => {
  assert.deepEqual(await shareProviderProfile(profile), {
    ok: false, code: "SHARE_UNAVAILABLE", url
  });
  assert.equal((await shareProviderProfile({ ...profile, providerId: "../admin" })).ok, false);
});

test("handles clipboard rejection without claiming success", async () => {
  const result = await shareProviderProfile(profile, {
    writeText: async () => { throw Error("permission denied"); }
  });
  assert.deepEqual(result, { ok: false, code: "CLIPBOARD_UNAVAILABLE", url });
});
