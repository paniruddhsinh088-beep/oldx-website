/** Service provider moderation adapter. Only call after audited rules are deployed. */
const allowedStatuses = new Set(["pending", "active", "suspended"]);
function requireAdmin(auth, db) {
  const uid = auth?.currentUser?.uid;
  if (typeof uid !== "string" || !uid || typeof db?.collection !== "function") {
    throw new Error("Authenticated admin and Firestore required.");
  }
  return uid;
}
/** Admin membership must be checked by Firestore rules, not this client. */
export async function listServiceProfilesForModeration({auth,db,status="pending",limit=20}) {
  requireAdmin(auth,db);
  if (!allowedStatuses.has(status)) throw new TypeError("Invalid moderation status.");
  if (!Number.isInteger(limit)||limit<1||limit>30) throw new RangeError("Invalid page limit.");
  const snapshot=await db.collection("serviceProviders").where("status","==",status).limit(limit).get();
  return snapshot.docs.map(doc=>({id:doc.id,displayName:doc.data().displayName??"",city:doc.data().city??"",serviceCategories:doc.data().serviceCategories??[],status:doc.data().status}));
}
export async function moderateServiceProfile({auth,db,providerId,status}) {
  requireAdmin(auth,db);
  if (typeof providerId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(providerId)) throw new TypeError("Invalid provider ID.");
  if (!allowedStatuses.has(status)) throw new TypeError("Invalid moderation status.");
  const timestamp=globalThis.firebase?.firestore?.FieldValue?.serverTimestamp;
  if (typeof timestamp!=="function") throw new Error("Firebase timestamp API unavailable.");
  await db.collection("serviceProviders").doc(providerId).update({status,updatedAt:timestamp()});
}
