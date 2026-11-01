import test from "node:test";
import assert from "node:assert/strict";
import { renderProviderShareCardSvg } from "./provider-share-card-svg.mjs";

const profile = {
  origin: "https://oldxbazar.in", providerId: "worker_42",
  displayName: "રમેશભાઈ", city: "અમદાવાદ",
  services: ["Carpenter", "Painter", "Electrician"]
};

test("renders standalone SVG with Gujarati name and share URL", () => {
  const result = renderProviderShareCardSvg(profile);
  assert.equal(result.ok, true);
  assert.equal(result.value.mimeType, "image/svg+xml");
  assert.match(result.value.svg, /રમેશભાઈ/);
  assert.match(result.value.svg, /અમદાવાદ/);
  assert.match(result.value.svg, /https:\/\/oldxbazar.in\/services\/provider\/worker_42/);
});

test("escapes XML special characters in user-provided content", () => {
  const result = renderProviderShareCardSvg({ ...profile, displayName: "Tom & Jerry", city: "A & B" });
  assert.equal(result.ok, true);
  assert.match(result.value.svg, /Tom &amp; Jerry/);
  assert.match(result.value.svg, /A &amp; B/);
});

test("does not leak private contact details or load remote photos", () => {
  const result = renderProviderShareCardSvg({
    ...profile, phone: "SECRET_PHONE", ownerUid: "SECRET_UID",
    photoUrl: "https://firebasestorage.googleapis.com/v0/b/test/o/photo.jpg"
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.photoIncluded, false);
  assert.doesNotMatch(result.value.svg, /SECRET_PHONE|SECRET_UID|firebasestorage/);
  assert.doesNotMatch(result.value.svg, /<image|<script|foreignObject/);
});

test("rejects unsafe share URL and invalid provider data", () => {
  assert.equal(renderProviderShareCardSvg({ ...profile, origin: "https://evil.example" }).ok, false);
  assert.equal(renderProviderShareCardSvg({ ...profile, providerId: "../admin" }).ok, false);
});
