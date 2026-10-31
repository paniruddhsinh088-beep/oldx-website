import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";

let testEnv;

before(async () => {
  const rules = await readFile(new URL("./deny-all.rules", import.meta.url), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-oldx-emulator",
    firestore: { rules }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test("trusted atomic batch commits domain mutation and audit event together", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "products/atomic-product"), { status: "active" });

    const batch = writeBatch(db);
    batch.update(doc(db, "products/atomic-product"), { status: "quarantined" });
    batch.set(doc(db, "adminAudit/atomic-event"), {
      actorUid: "synthetic-admin",
      operation: "products.quarantine",
      targetId: "atomic-product",
      reasonCode: "POLICY_REVIEW"
    });
    await batch.commit();

    const product = await getDoc(doc(db, "products/atomic-product"));
    const audit = await getDoc(doc(db, "adminAudit/atomic-event"));
    assert.equal(product.data().status, "quarantined");
    assert.equal(audit.data().operation, "products.quarantine");
  });
});

test("failed atomic batch does not leave domain mutation without audit", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "products/rollback-product"), { status: "active" });

    const batch = writeBatch(db);
    batch.update(doc(db, "products/rollback-product"), { status: "quarantined" });
    // update() on a missing audit document forces the entire batch to fail.
    batch.update(doc(db, "adminAudit/missing-event"), {
      operation: "products.quarantine"
    });

    await assert.rejects(() => batch.commit());
    const product = await getDoc(doc(db, "products/rollback-product"));
    const audit = await getDoc(doc(db, "adminAudit/missing-event"));
    assert.equal(product.data().status, "active");
    assert.equal(audit.exists(), false);
  });
});

test("client identities including admin-claim-like users cannot write audit records", async () => {
  const ordinary = testEnv.authenticatedContext("sellerA").firestore();
  const claimedAdmin = testEnv.authenticatedContext("ownerA", { admin: true }).firestore();
  await assertFails(setDoc(doc(ordinary, "adminAudit/client-forgery"), { actorUid: "sellerA" }));
  await assertFails(setDoc(doc(claimedAdmin, "adminAudit/client-forgery-2"), { actorUid: "ownerA" }));
});
