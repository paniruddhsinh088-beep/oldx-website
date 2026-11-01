import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderShareMetadata } from "./provider-share.mjs";

const valid = {
  origin: "https://oldxbazar.in",
  providerId: "provider_123",
  displayName: "કિરણભાઈ",
  city: "અમદાવાદ",
  services: ["Carpenter", "Furniture repair"]
};

test("creates stable HTTPS provider link with multilingual preview metadata", () => {
  const result = buildProviderShareMetadata(valid);
  assert.deepEqual(result, {
    ok: true,
    value: {
      url: "https://oldxbazar.in/services/provider/provider_123",
      title: "કિરણભાઈ | OLDX Services",
      description: "Carpenter, Furniture repair • અમદાવાદ"
    }
  });
});

test("rejects insecure and injected share origins", () => {
  for (const origin of [
    "http://oldxbazar.in", "javascript:alert(1)",
    "https://user:pass@oldxbazar.in", "https://oldxbazar.in/other",
    "https://oldxbazar.in?x=1", "https://oldxbazar.in:444",
    "https://fake-oldx.example", "https://oldxbazar.in.evil.example"
  ]) {
    assert.equal(buildProviderShareMetadata({ ...valid, origin }).ok, false);
  }
});

test("rejects malformed identifiers and unsafe display content", () => {
  for (const patch of [
    { providerId: "../admin" }, { providerId: " " },
    { displayName: "<script>" }, { services: [] },
    { city: "<img>" }
  ]) {
    assert.equal(buildProviderShareMetadata({ ...valid, ...patch }).ok, false);
  }
});

test("share metadata does not expose contact or owner information", () => {
  const result = buildProviderShareMetadata({
    ...valid, phone: "private", ownerUid: "secret", exactLocation: { lat: 1, lng: 2 }
  });
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result.value);
  for (const secret of ["private", "secret", "exactLocation"]) {
    assert.equal(serialized.includes(secret), false);
  }
});
