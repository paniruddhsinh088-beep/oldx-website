import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv;

before(async () => {
  const rules = await readFile(
    new URL("./deny-all.rules", import.meta.url),
    "utf8"
  );
  testEnv = await initializeTestEnvironment({
    projectId: "demo-oldx-emulator",
    firestore: { rules }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test("unauthenticated client cannot read Firestore documents", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "products/synthetic-product")));
});

test("unauthenticated client cannot create Firestore documents", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "products/guest-write"), { title: "Synthetic" }));
});

test("authenticated seller cannot read under deny-all baseline", async () => {
  const db = testEnv.authenticatedContext("sellerA").firestore();
  await assertFails(getDoc(doc(db, "products/synthetic-product")));
});

test("authenticated seller cannot write under deny-all baseline", async () => {
  const db = testEnv.authenticatedContext("sellerA").firestore();
  await assertFails(setDoc(doc(db, "products/seller-write"), {
    sellerUid: "sellerA",
    title: "Synthetic"
  }));
});

test("authenticated admin-like user is also denied by baseline", async () => {
  const db = testEnv.authenticatedContext("ownerA", { admin: true }).firestore();
  await assertFails(getDoc(doc(db, "users/synthetic-user")));
  await assertFails(setDoc(doc(db, "users/forbidden-write"), { role: "admin" }));
});
