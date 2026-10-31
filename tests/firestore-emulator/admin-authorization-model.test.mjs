import test from "node:test";
import assert from "node:assert/strict";
import { adminDecision } from "./admin-authorization-model.mjs";

const admin = { role: "admin", active: true };
const operations = [
  "dashboard.read", "users.list", "users.read", "users.suspend", "users.restore",
  "users.deletion.request", "products.list", "products.read", "products.create",
  "products.update", "products.feature", "products.verify", "products.quarantine",
  "products.restore", "stores.list", "stores.read", "stores.review", "stores.verify",
  "stores.suspend", "stores.restore", "reports.list", "reports.read", "reports.resolve",
  "reports.escalate", "settings.business.read", "settings.business.update", "audit.read"
];

test("active Admin is allowed all defined platform operations", () => {
  for (const operation of operations) assert.equal(adminDecision({ ...admin, operation }), true, operation);
});

test("guest and ordinary user are denied all Admin operations", () => {
  for (const operation of operations) {
    assert.equal(adminDecision({ role: "user", active: true, operation }), false, operation);
    assert.equal(adminDecision({ role: "user", active: false, operation }), false, operation);
    assert.equal(adminDecision({ role: "admin", active: false, operation }), false, operation);
    assert.equal(adminDecision({ role: "user", active: false, operation }), false, operation);
  }
});

test("Admin cannot grant roles, promote identities or tamper with audit controls", () => {
  for (const operation of ["roles.grant", "roles.revoke", "roles.promote", "audit.erase", "audit.disable"]) {
    assert.equal(adminDecision({ ...admin, operation }), false, operation);
  }
});

test("Admin cannot read credentials, tokens or infrastructure secrets", () => {
  for (const operation of ["secrets.read", "passwords.read", "tokens.read", "serviceCredentials.read", "productionInfrastructure.manage"]) {
    assert.equal(adminDecision({ ...admin, operation }), false, operation);
  }
});

test("sensitive chat access requires a case-linked safety purpose", () => {
  assert.equal(adminDecision({ ...admin, operation: "chats.safety.read", caseLinked: true }), true);
  assert.equal(adminDecision({ ...admin, operation: "chats.safety.read", caseLinked: false }), false);
});

test("unknown operations fail closed", () => {
  assert.equal(adminDecision({ ...admin, operation: "arbitrary.collection.dump" }), false);
});

test("seller listing ownership and isSold behavior are explicitly outside Admin role model", () => {
  assert.equal(adminDecision({ ...admin, operation: "seller.products.toggleSold" }), false);
});
