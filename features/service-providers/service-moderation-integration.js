/** Opt-in integration for a protected admin page; never auto-mounts. */
import {mountServiceModeration} from "./service-moderation-ui.js";
import {listServiceProfilesForModeration,moderateServiceProfile} from "./service-moderation-adapter.js";
/** Call only after server-enforced admin rules have been deployed and verified. */
export function mountFirestoreServiceModeration(container,{auth,db,enabled=false}={}) {
 if(enabled!==true)throw new Error("Service moderation integration is disabled until admin rules are verified.");
 if(!auth?.currentUser?.uid||typeof db?.collection!=="function")throw new Error("Sign in as an admin to moderate profiles.");
 const ui=mountServiceModeration(container,{
  loadPending:()=>listServiceProfilesForModeration({auth,db,status:"pending",limit:20}),
  onModerate:(providerId,status)=>moderateServiceProfile({auth,db,providerId,status})
 });
 void ui.refresh();
 return ui;
}
