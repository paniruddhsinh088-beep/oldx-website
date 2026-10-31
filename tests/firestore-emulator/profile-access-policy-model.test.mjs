import test from "node:test";
import assert from "node:assert/strict";
import { profileAccessDecision } from "./profile-access-policy-model.mjs";

const A = "synthetic-user-a";
const B = "synthetic-user-b";

test("guest can read candidate public profile projection", () => {
  assert.equal(profileAccessDecision({ ownerUid: A, resource: "public", operation: "read" }), true);
});

test("authenticated user can read another user's candidate public profile", () => {
  assert.equal(profileAccessDecision({ actorUid: B, ownerUid: A, resource: "public", operation: "read" }), true);
});

test("only owner can create or update their own allowlisted public fields", () => {
  assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "public", operation: "update", fields: ["displayName", "photoURL"] }), true);
  assert.equal(profileAccessDecision({ actorUid: B, ownerUid: A, resource: "public", operation: "update", fields: ["displayName"] }), false);
});

test("public profile writes reject private, privileged and arbitrary fields", () => {
  for (const field of ["email", "lastIp", "userIp", "role", "isOnline", "lastSeen", "savedAds", "blockedUsers", "customSecret"]) {
    assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "public", operation: "update", fields: [field] }), false, field);
  }
});

test("only owner can read their private profile", () => {
  assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "private", operation: "read" }), true);
  assert.equal(profileAccessDecision({ actorUid: B, ownerUid: A, resource: "private", operation: "read" }), false);
  assert.equal(profileAccessDecision({ ownerUid: A, resource: "private", operation: "read" }), false);
});

test("only owner can update allowlisted private preferences", () => {
  assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "private", operation: "update", fields: ["savedAds", "blockedUsers"] }), true);
  assert.equal(profileAccessDecision({ actorUid: B, ownerUid: A, resource: "private", operation: "update", fields: ["savedAds"] }), false);
  assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "private", operation: "update", fields: ["email"] }), false);
});

test("clients cannot access trusted role, audit, IP or migration resources", () => {
  for (const operation of ["read", "create", "update", "delete"]) {
    assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "trusted", operation }), false);
  }
});

test("client deletes are denied; account cleanup stays in trusted workflow", () => {
  for (const resource of ["public", "private"]) {
    assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource, operation: "delete" }), false);
  }
});

test("unknown resource, operation context and empty field updates fail closed", () => {
  assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "unknown", operation: "read" }), false);
  assert.equal(profileAccessDecision({ actorUid: A, ownerUid: A, resource: "private", operation: "update", fields: [] }), false);
});
