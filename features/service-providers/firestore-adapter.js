/**
 * OLDX service provider Firestore adapter.
 * Uses Firebase v9 compat Firestore already loaded by index.html.
 * IMPORTANT: client checks are UX only; deploy tested Firestore security rules
 * before enabling this adapter in the app. No automatic writes occur.
 */
import { validateServiceProviderProfile } from "./profile-form.js";

const COLLECTION = "serviceProviders";

function requireUser(auth) {
  const user = auth?.currentUser;
  if (!user || typeof user.uid !== "string" || !user.uid) {
    throw new Error("Sign in to manage your service profile.");
  }
  return user;
}

function requireFirestore(db) {
  if (!db || typeof db.collection !== "function") {
    throw new TypeError("Firebase Firestore compat instance is required.");
  }
  return db;
}

/**
 * Only call after server-side Firestore rules have been reviewed and deployed.
 * This intentionally does not set status, ownerUid or moderation fields on edits.
 */
export async function saveMyServiceProfile({ auth, db, input }) {
  const user = requireUser(auth);
  requireFirestore(db);
  const result = validateServiceProviderProfile(input);
  if (!result.valid) {
    throw new Error(Object.values(result.errors).join(" "));
  }
  const ref = db.collection(COLLECTION).doc(user.uid);
  const snapshot = await ref.get();
  const profile = {
    ...result.value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (snapshot.exists) {
    if (snapshot.data()?.ownerUid !== user.uid) {
      throw new Error("Profile ownership mismatch.");
    }
    await ref.update(profile);
  } else {
    await ref.set({
      ...profile,
      ownerUid: user.uid,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  return user.uid;
}

export async function getMyServiceProfile({ auth, db }) {
  const user = requireUser(auth);
  requireFirestore(db);
  const snapshot = await db.collection(COLLECTION).doc(user.uid).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** Public browsing: read only active profiles, limited batch. */
export async function listActiveServiceProfiles({ db, limit = 20 }) {
  requireFirestore(db);
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
    throw new RangeError("Limit must be between 1 and 30.");
  }
  const query = db.collection(COLLECTION)
    .where("status", "==", "active")
    .limit(limit);
  const result = await query.get();
  return result.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      status: "active", // Query restricts results to active profiles; required by directory filter.
      displayName: data.displayName ?? "",
      description: data.description ?? "",
      city: data.city ?? "",
      district: data.district ?? "",
      state: data.state ?? "",
      serviceCategories: Array.isArray(data.serviceCategories) ? data.serviceCategories : []
    };
  });
}

/** Read an approved public profile by ID. Pending and suspended profiles are hidden. */
export async function getActiveServiceProfile({ db, providerId }) {
  requireFirestore(db);
  if (typeof providerId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(providerId)) {
    throw new TypeError("Invalid service provider ID.");
  }
  const snapshot = await db.collection(COLLECTION).doc(providerId).get();
  if (!snapshot.exists || snapshot.data()?.status !== "active") return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    status: "active",
    displayName: data.displayName ?? "",
    description: data.description ?? "",
    city: data.city ?? "",
    district: data.district ?? "",
    state: data.state ?? "",
    serviceCategories: Array.isArray(data.serviceCategories) ? data.serviceCategories : []
  };
}
