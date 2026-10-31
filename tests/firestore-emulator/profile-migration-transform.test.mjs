import test from "node:test";
import assert from "node:assert/strict";
import { projectLegacyUser, preserveNewerTarget } from "./profile-migration-transform.mjs";

test("public projection contains only approved display name and trusted HTTPS photo URL", () => {
  const result = projectLegacyUser({
    displayName: "  Synthetic User  ",
    photoURL: "https://lh3.googleusercontent.com/a/synthetic",
    email: "private@example.invalid",
    savedAds: ["ad-one"],
    blockedUsers: ["user-two"],
    lastIp: "203.0.113.10",
    role: "admin",
    isOnline: true,
    lastSeen: "sensitive"
  });
  assert.deepEqual(result.publicProfile, {
    displayName: "Synthetic User",
    photoURL: "https://lh3.googleusercontent.com/a/synthetic"
  });
});

test("private projection keeps only bounded saved-ad and block UID lists", () => {
  const result = projectLegacyUser({
    savedAds: ["ad_1", "ad_1", "../bad", 5, "x".repeat(129)],
    blockedUsers: ["user-2", "user-2", "bad uid"]
  });
  assert.deepEqual(result.privateProfile, {
    savedAds: ["ad_1"],
    blockedUsers: ["user-2"]
  });
});

test("email, IP, presence and arbitrary legacy keys are never projected", () => {
  const result = projectLegacyUser({
    email: "private@example.invalid",
    lastIp: "203.0.113.5",
    userIp: "203.0.113.6",
    isOnline: true,
    lastSeen: "now",
    role: "admin",
    customSecret: "do-not-copy"
  });
  assert.deepEqual(result.publicProfile, {});
  assert.deepEqual(result.privateProfile, { savedAds: [], blockedUsers: [] });
});

test("untrusted, non-HTTPS and oversized photo URLs are omitted", () => {
  for (const photoURL of [
    "javascript:alert(1)",
    "http://lh3.googleusercontent.com/a",
    "https://evil.example/a",
    "https://lh3.googleusercontent.com/" + "x".repeat(2050)
  ]) {
    assert.deepEqual(projectLegacyUser({ photoURL }).publicProfile, {});
  }
});

test("invalid and overlong display names are omitted", () => {
  assert.deepEqual(projectLegacyUser({ displayName: " " }).publicProfile, {});
  assert.deepEqual(projectLegacyUser({ displayName: "x".repeat(81) }).publicProfile, {});
});

test("re-running projection with the same input is deterministic", () => {
  const legacy = {
    displayName: "Synthetic A",
    photoURL: "https://res.cloudinary.com/demo/image/upload/a.jpg",
    savedAds: ["one", "two"],
    blockedUsers: ["three"]
  };
  assert.deepEqual(projectLegacyUser(legacy), projectLegacyUser(legacy));
});

test("newer target values are preserved over stale legacy proposals", () => {
  assert.deepEqual(
    preserveNewerTarget(
      { displayName: "New name", savedAds: ["new-ad"] },
      { displayName: "Old name", photoURL: "https://lh3.googleusercontent.com/a", savedAds: ["old-ad"] }
    ),
    { displayName: "New name", photoURL: "https://lh3.googleusercontent.com/a", savedAds: ["new-ad"] }
  );
});

test("migration helper is pure and does not reference Firebase or production projects", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./profile-migration-transform.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /firebase-admin|initializeApp|oldx-1c983|oldx-staging|fetch\s*\(/i);
});

test("saved-ad and blocked-user arrays are capped to their documented bounds", () => {
  const savedAds = Array.from({ length: 125 }, (_, i) => `ad_${i}`);
  const blockedUsers = Array.from({ length: 225 }, (_, i) => `user_${i}`);
  const result = projectLegacyUser({ savedAds, blockedUsers });
  assert.equal(result.privateProfile.savedAds.length, 100);
  assert.equal(result.privateProfile.blockedUsers.length, 200);
  assert.equal(result.privateProfile.savedAds[99], "ad_99");
  assert.equal(result.privateProfile.blockedUsers[199], "user_199");
});

test("non-array and malformed private preference values safely become empty lists", () => {
  const result = projectLegacyUser({
    savedAds: { first: "ad-one" },
    blockedUsers: "user-two"
  });
  assert.deepEqual(result.privateProfile, {
    savedAds: [],
    blockedUsers: []
  });
});

test("projection does not mutate the legacy input object or its arrays", () => {
  const legacy = {
    displayName: "Synthetic",
    savedAds: ["ad-one", "ad-one", "../invalid"],
    blockedUsers: ["user-one"]
  };
  const before = structuredClone(legacy);
  projectLegacyUser(legacy);
  assert.deepEqual(legacy, before);
});
