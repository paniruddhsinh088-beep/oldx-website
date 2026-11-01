/**
 * Booking/review permission tests against the draft rules + fragment.
 * Run with Firestore emulator (127.0.0.1:8080) and:
 *   node --test features/service-providers/tests/booking-review.rules.test.cjs
 * These are isolated tests, NOT production authorization guarantees.
 */
const { test, before, after, beforeEach } = require("node:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, collection, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } = require("firebase/firestore");

const root = resolve(__dirname, "..");
const draft = readFileSync(resolve(root, "firestore.rules.draft"), "utf8");
const fragment = readFileSync(resolve(root, "booking-review.rules.fragment"), "utf8");
const anchor = "    // Existing OLDX collection rules must be preserved when merging.";
if (!draft.includes(anchor)) throw Error("Cannot locate rule insertion point");
const rules = draft.replace(anchor, fragment + "\n" + anchor);

let env;
const bookingPath = "serviceBookings/booking1";
const reviewPath = "serviceProviders/provider1/reviews/booking1";
const booking = {
  buyerUid: "buyer1", providerUid: "provider1", status: "completed",
  reviewEligible: true
};
const review = {
  bookingId: "booking1", buyerUid: "buyer1", providerUid: "provider1",
  rating: 5, comment: "Great service", status: "pending"
};
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const seed = async (path, value) => env.withSecurityRulesDisabled(async context =>
  setDoc(doc(context.firestore(), path), value));

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-oldx-service",
    firestore: { host: "127.0.0.1", port: 8080, rules }
  });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

test("buyer and provider can read their booking", async () => {
  await seed(bookingPath, booking);
  await assertSucceeds(getDoc(doc(db("buyer1"), bookingPath)));
  await assertSucceeds(getDoc(doc(db("provider1"), bookingPath)));
});
test("other user and guest cannot read booking", async () => {
  await seed(bookingPath, booking);
  await assertFails(getDoc(doc(db("stranger"), bookingPath)));
  await assertFails(getDoc(doc(db(), bookingPath)));
});
test("clients cannot create or forge completed bookings", async () => {
  for (const uid of ["buyer1", "provider1"]) {
    await assertFails(setDoc(doc(db(uid), bookingPath), booking));
  }
});
test("clients cannot change booking completion or eligibility", async () => {
  await seed(bookingPath, {...booking, status:"requested", reviewEligible:false});
  await assertFails(updateDoc(doc(db("buyer1"), bookingPath), {status:"completed", reviewEligible:true}));
  await assertFails(updateDoc(doc(db("provider1"), bookingPath), {status:"completed", reviewEligible:true}));
  await assertFails(deleteDoc(doc(db("buyer1"), bookingPath)));
});
test("booking collection scans are denied", async () => {
  await seed(bookingPath, booking);
  await assertFails(getDocs(collection(db("buyer1"), "serviceBookings")));
});
test("pending reviews cannot be read publicly", async () => {
  await seed(reviewPath, review);
  await assertFails(getDoc(doc(db(), reviewPath)));
  await assertFails(getDoc(doc(db("buyer1"), reviewPath)));
});
test("published reviews can be read publicly", async () => {
  await seed(reviewPath, {...review, status:"published"});
  await assertSucceeds(getDoc(doc(db(), reviewPath)));
});
test("public review listing requires published status filter", async () => {
  await seed(reviewPath, {...review, status:"published"});
  const reviews = collection(db(), "serviceProviders/provider1/reviews");
  await assertSucceeds(getDocs(query(reviews, where("status", "==", "published"))));
  await assertFails(getDocs(reviews));
});
test("client review creation is denied even for completed booking", async () => {
  await seed(bookingPath, booking);
  await assertFails(setDoc(doc(db("buyer1"), reviewPath), review));
  await assertFails(setDoc(doc(db("provider1"), reviewPath), review));
});
test("clients cannot publish, edit or delete reviews", async () => {
  await seed(reviewPath, review);
  await assertFails(updateDoc(doc(db("buyer1"), reviewPath), {status:"published"}));
  await assertFails(updateDoc(doc(db("provider1"), reviewPath), {rating:1}));
  await assertFails(deleteDoc(doc(db("buyer1"), reviewPath)));
});
