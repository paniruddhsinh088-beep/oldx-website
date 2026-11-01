/**
 * Run from features/service-providers/tests:
 * npm install
 * firebase emulators:exec --only firestore --project demo-oldx-service "npm test"
 * Requires Firebase CLI and Java.
 * This test suite is not a substitute for testing the merged OLDX rules.
 */
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test, before, after } = require("node:test");
const { Timestamp, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } = require("firebase/firestore");

let env;
const uid = "providerA";
const profilePath = "serviceProviders/" + uid;
const base = () => ({
  ownerUid: uid, displayName: "Example Provider", description: "Home repairs",
  city: "Ahmedabad", district: "Ahmedabad", state: "Gujarat",
  serviceCategories: ["carpenter", "plumber"], status: "pending",
  createdAt: serverTimestamp(), updatedAt: serverTimestamp()
});
const userDb = id => env.authenticatedContext(id).firestore();
const guestDb = () => env.unauthenticatedContext().firestore();
const ref = db => doc(db, profilePath);
const seed = async (data) => env.withSecurityRulesDisabled(async context => {
  await setDoc(ref(context.firestore()), data);
});
const seeded = (status = "pending") => ({
  ...base(), status,
  createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000)
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-oldx-service",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules.draft"), "utf8"),
      host: "127.0.0.1", port: 8080
    }
  });
});
after(async () => { if (env) await env.cleanup(); });

test("owner can create a pending profile", async () => {
  await env.clearFirestore();
  await assertSucceeds(setDoc(ref(userDb(uid)), base()));
});
test("guest cannot create", async () => {
  await env.clearFirestore();
  await assertFails(setDoc(ref(guestDb()), base()));
});
test("another user cannot create provider's document", async () => {
  await env.clearFirestore();
  await assertFails(setDoc(ref(userDb("attacker")), base()));
});
test("provider cannot self-approve", async () => {
  await env.clearFirestore();
  await assertFails(setDoc(ref(userDb(uid)), { ...base(), status: "active" }));
});
test("owner can edit safe fields but not status or ownerUid", async () => {
  await env.clearFirestore();
  await seed(seeded());
  await assertSucceeds(updateDoc(ref(userDb(uid)), { displayName: "Updated Provider", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(userDb(uid)), { status: "active", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(userDb(uid)), { ownerUid: "attacker", updatedAt: serverTimestamp() }));
});
test("other users cannot edit or delete profiles", async () => {
  await env.clearFirestore();
  await seed(seeded());
  await assertFails(updateDoc(ref(userDb("attacker")), { displayName: "Changed" }));
  await assertFails(deleteDoc(ref(userDb("attacker"))));
});
test("pending profile is private; active profile is public", async () => {
  await env.clearFirestore();
  await seed(seeded());
  await assertSucceeds(getDoc(ref(userDb(uid))));
  await assertFails(getDoc(ref(guestDb())));
  await seed(seeded("active"));
  await assertSucceeds(getDoc(ref(guestDb())));
});
test("public listing must filter active profiles", async () => {
  await env.clearFirestore();
  await seed(seeded("active"));
  const db = guestDb();
  await assertSucceeds(getDocs(query(collection(db, "serviceProviders"), where("status", "==", "active"))));
  await assertFails(getDocs(collection(db, "serviceProviders")));
});
test("review writes are disabled until verified-buyer rules exist", async () => {
  await env.clearFirestore();
  await assertFails(setDoc(doc(userDb("buyer"), profilePath + "/reviews/buyer"), {
    reviewerUid: "buyer", rating: 5, comment: "Good"
  }));
});
test("existing unrelated collections remain denied in this isolated draft", async () => {
  await env.clearFirestore();
  await assertFails(getDoc(doc(guestDb(), "products/example")));
});
