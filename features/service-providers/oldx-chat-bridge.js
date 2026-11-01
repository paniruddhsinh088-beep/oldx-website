/**
 * OLDX service-provider chat launcher.
 * A safe integration boundary: it checks both users' blocks and prepares
 * canonical chat metadata, but never writes to Firestore itself.
 * The host must provide an audited chat opener that enforces the same checks.
 */
import {buildServiceChatContext} from "./chat-context.js";
import {invokeServiceContact} from "./oldx-contact-adapter.js";

export async function openVerifiedServiceChat({
  auth, db, providerUid, providerStatus, openExistingChat
} = {}) {
  if (typeof openExistingChat !== "function") {
    throw new TypeError("Audited OLDX chat opener required");
  }
  const buyerUid=auth?.currentUser?.uid;
  // Reject bad context before reading user documents.
  const context=buildServiceChatContext({providerUid,buyerUid});
  const result=await invokeServiceContact({
    action:"chat",auth,db,providerUid,providerStatus,
    onAllowed:()=>openExistingChat(context)
  });
  return { ...result, context:result.allowed ? context : null };
}
