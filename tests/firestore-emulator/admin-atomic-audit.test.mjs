import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";

let testEnv;
let trustedDb;

before(async () => {
  const rules = await readFile(new URL("./deny-all.rules", import.meta.url), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-oldx-emulator",
    firestore: { rules }
  });
  // Simulates a trusted server adapter only inside the isolated Emulator.
  // This is not a production Admin SDK integration.
  trustedDb = testEnv.withSecurityRulesDisabled((context) => context.firestore());
});

after(async () => {
  await testEnv?.cleanup();
});

test("trusted atomic batch commits domain mutation and audit event together", async () => {
  await setDoc(doc(trustedDb, "products/atomic-product"), { status: "active" });

  const batch = writeBatch(trustedDb);
  batch.update(doc(trustedDb, "products/atomic-product"), { status: "quarantined" });
  batch.set(doc(trustedDb, "adminAudit/atomic-event"), {
    actorUid: "synthetic-admin",
    operation: "products.quarantine",
    targetId: "atomic-product",
    reasonCode: "POLICY_REVIEW"
  });
  await batch.commit();

  const product = await getDoc(doc(trustedDb, "products/atomic-product"));
  const audit = await getDoc(doc(trustedDb, "adminAudit/atomic-event"));
  assert.equal(product.data().status, "quarantined");
  assert.equal(audit.data().operation, "products.quarantine");
});

test("failed atomic batch does not leave domain mutation without audit", async () => {
  await setDoc(doc(trustedDb, "products/rollback-product"), { status: "active" });

  const batch = writeBatch(trustedDb);
  batch.update(doc(trustedDb, "products/rollback-product"), { status: "quarantined" });
  // update() on a missing audit document forces the entire batch to fail.
  batch.update(doc(trustedDb, "adminAudit/missing-event"), {
    operation: "products.quarantine"
  });

  await assert.rejects(() => batch.commit());
  const product = await getDoc(doc(trustedDb, "products/rollback-product"));
  const audit = await getDoc(doc(trustedDb, "adminAudit/missing-event"));
  assert.equal(product.data().status, "active");
  assert.equal(audit.exists(), false);
});

test("client identities including admin-claim-like users cannot write audit records", async () => {
  const ordinary = testEnv.authenticatedContext("sellerA").firestore();
  const claimedAdmin = testEnv.authenticatedContext("ownerA", { admin: true }).firestore();
  await assertFails(setDoc(doc(ordinary, "adminAudit/client-forgery"), { actorUid: "sellerA" }));
  await assertFails(setDoc(doc(claimedAdmin, "adminAudit/client-forgery-2"), { actorUid: "ownerA" }));
});
