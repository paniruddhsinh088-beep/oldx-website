/**
 * Firestore compat integration for OLDX provider contact checks.
 * Reads both users' block lists; fail closed if either read fails.
 * This does NOT authorize Firestore chat writes. Enforce rules server-side.
 */
import { requestServiceContact } from "./contact-policy.js";

function uidOf(user) {
  return typeof user?.uid === "string" && user.uid.trim() ? user.uid : null;
}
function validDb(db) {
  if (!db || typeof db.collection !== "function") throw new TypeError("Firestore compat instance required");
}
function blockedList(snapshot) {
  if (!snapshot?.exists) throw new Error("Cannot verify user contact permissions.");
  const value = snapshot.data()?.blockedUsers;
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(id => typeof id !== "string")) {
    throw new Error("Invalid blocked users data.");
  }
  return value;
}
export async function resolveServiceContactPermissions({ auth, db, providerUid, providerStatus }) {
  validDb(db);
  const viewerUid = uidOf(auth?.currentUser);
  if (!viewerUid || typeof providerUid !== "string" || !providerUid.trim()) {
    return { viewerUid, providerUid, providerStatus };
  }
  if (viewerUid === providerUid || providerStatus !== "active") {
    return { viewerUid, providerUid, providerStatus };
  }
  const [viewer, provider] = await Promise.all([
    db.collection("users").doc(viewerUid).get(),
    db.collection("users").doc(providerUid).get()
  ]);
  const viewerBlocks = blockedList(viewer);
  const providerBlocks = blockedList(provider);
  return {
    viewerUid, providerUid, providerStatus,
    blockedByViewer: viewerBlocks.includes(providerUid),
    blockedByProvider: providerBlocks.includes(viewerUid)
  };
}

/**
 * Checks current auth and both lists immediately before invoking host action.
 * Existing OLDX chat/WhatsApp handlers must be passed as onAllowed.
 */
export async function invokeServiceContact({ action, auth, db, providerUid, providerStatus, onAllowed }) {
  try {
    return await requestServiceContact({
      action,
      resolvePermissions: () => resolveServiceContactPermissions({auth,db,providerUid,providerStatus}),
      onAllowed
    });
  } catch (error) {
    // Never continue contact action on Firestore read/permission/network errors.
    if (error instanceof TypeError && (typeof onAllowed !== "function" || !["chat","whatsapp","call"].includes(action))) {
      throw error;
    }
    return { allowed:false, reason:"Could not verify contact permissions. Please try again." };
  }
}
