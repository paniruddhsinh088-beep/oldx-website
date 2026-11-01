import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderShareCard } from "./provider-share-card.mjs";

const profile = {
  origin: "https://oldxbazar.in",
  providerId: "worker_42",
  displayName: "રમેશભાઈ",
  city: "અમદાવાદ",
  services: ["Carpenter", "Painter", "Electrician", "Repair"],
  photoUrl: "https://firebasestorage.googleapis.com/v0/b/test/o/photo.jpg?alt=media"
};

test("builds multilingual share card with approved image URL", () => {
  const result = buildProviderShareCard(profile);
  assert.equal(result.ok, true);
  assert.equal(result.value.displayName, "રમેશભાઈ");
  assert.equal(result.value.url, "https://oldxbazar.in/services/provider/worker_42");
  assert.equal(result.value.photoUrl, profile.photoUrl);
  assert.deepEqual(result.value.services, ["Carpenter", "Painter", "Electrician"]);
});

test("supports no-photo card without forcing paid storage", () => {
  const result = buildProviderShareCard({ ...profile, photoUrl: null });
  assert.equal(result.ok, true);
  assert.equal(result.value.photoUrl, null);
});

test("rejects non-HTTPS, tracking and unapproved image hosts", () => {
  for (const photoUrl of [
    "http://firebasestorage.googleapis.com/photo",
    "https://example.com/photo.png",
    "https://firebasestorage.googleapis.com.evil.example/photo",
    "javascript:alert(1)",
    "https://user:password@res.cloudinary.com/photo",
    "https://res.cloudinary.com:444/photo"
  ]) {
    assert.equal(buildProviderShareCard({ ...profile, photoUrl }).ok, false);
  }
});

test("omits private profile information from share card", () => {
  const result = buildProviderShareCard({
    ...profile, phone: "PRIVATE_PHONE", ownerUid: "PRIVATE_UID",
    exactAddress: "PRIVATE_ADDRESS", email: "PRIVATE_EMAIL"
  });
  assert.equal(result.ok, true);
  const output = JSON.stringify(result.value);
  for (const value of ["PRIVATE_PHONE", "PRIVATE_UID", "PRIVATE_ADDRESS", "PRIVATE_EMAIL"]) {
    assert.equal(output.includes(value), false);
  }
});

test("invalid public profile cannot produce share card", () => {
  assert.equal(buildProviderShareCard({ ...profile, providerId: "../admin" }).ok, false);
});
