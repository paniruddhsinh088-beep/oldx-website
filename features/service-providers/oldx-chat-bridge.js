/**
 * OLDX service-provider chat launcher.
 * A safe integration boundary: it checks both users' blocks and prepares
 * canonical chat metadata, but never writes to Firestore itself.
 * The host must provide an audited chat opener that enforces the same checks.
 */
import {buildServiceChatContext} from "./chat-context.js";
import {invokeServiceContact} from "./oldx-contact-adapter.js";

export async function openVerifiedServiceChat({
  auth, db, providerUid, openExistingChat
} = {}) {
  if (typeof openExistingChat !== "function") {
    throw new TypeError("Audited OLDX chat opener required");
  }
  const buyerUid=auth?.currentUser?.uid;
  if (!buyerUid) {
    return {allowed:false,reason:"Sign in to chat with a service provider.",context:null};
  }
  // Reject bad context before reading user documents.
  const context=buildServiceChatContext({providerUid,buyerUid});
  // Never trust an "active" status supplied by a card or URL.
  // Fetch the provider document immediately before the contact permission check.
  let providerStatus="unavailable";
  try {
    const snap=await db.collection("serviceProviders").doc(providerUid).get();
    const profile=snap.exists ? snap.data() : null;
    if (profile?.ownerUid === providerUid && profile?.status === "active") {
      providerStatus="active";
    }
  } catch {
    return {allowed:false,reason:"Could not verify service provider.",context:null};
  }
  // The account can change while the provider document is being fetched.
  if (auth?.currentUser?.uid !== buyerUid) {
    return {allowed:false,reason:"Your session changed. Please try again.",context:null};
  }
  const result=await invokeServiceContact({
    action:"chat",auth,db,providerUid,providerStatus,
    onAllowed:()=>openExistingChat(context)
  });
  return { ...result, context:result.allowed ? context : null };
}
