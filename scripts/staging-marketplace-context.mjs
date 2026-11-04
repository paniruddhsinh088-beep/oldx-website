import {safeId} from './isolated-firestore-context.mjs';
export const STAGING_MARKETPLACE_COLLECTIONS=Object.freeze({actors:'marketplaceActors_v1',privateRecords:'marketplacePrivate_v1',publicViews:'marketplacePublic_v1',owners:'marketplaceOwners_v1',generations:'marketplaceGenerations_v1',receipts:'marketplaceReceipts_v1',audits:'marketplaceAudit_v1'});
export const STAGING_RATE_COLLECTION='marketplaceRateLimits_v1';
const bindings=new WeakSet();
// Native Admin API normalization only; never initializes an app/credential/client.
// Existing demo SDK context remains unchanged and never accepts this binding.
export function createStagingMarketplaceBinding({adminFirestore,FieldValue,deploymentEnvironment,projectId}={}){
 const check=()=>{if(deploymentEnvironment!=='preview'||projectId!=='oldx-staging'||adminFirestore?.projectId!=='oldx-staging'||typeof adminFirestore.collection!=='function'||typeof adminFirestore.runTransaction!=='function'||typeof FieldValue?.serverTimestamp!=='function')throw Error('Staging binding unavailable');};check();
 const allowed=new Set([...Object.values(STAGING_MARKETPLACE_COLLECTIONS),STAGING_RATE_COLLECTION]);
 const references=new WeakMap(),db=adminFirestore;
 const native=ref=>{check();const value=references.get(ref);if(!value)throw Error('Unbound staging reference');return value;};
 const sdk=Object.freeze({
  doc(database,collection,id){check();if(database!==db||!allowed.has(collection)||!safeId(id))throw Error('Staging reference denied');const ref=Object.freeze({path:collection+'/'+id});references.set(ref,db.collection(collection).doc(id));return ref;},
  serverTimestamp(){check();return FieldValue.serverTimestamp();},
  async runTransaction(database,callback,options){check();if(database!==db||options?.maxAttempts!==3)throw Error('Staging transaction denied');return db.runTransaction(async tx=>{
   check();return callback(Object.freeze({async get(ref){const snapshot=await tx.get(native(ref));check();if(typeof snapshot.exists!=='boolean')throw Error('Invalid Admin snapshot');return {exists:()=>snapshot.exists,data:()=>snapshot.data()};},set(ref,value){check();tx.set(native(ref),value);},delete(ref){check();tx.delete(native(ref));}}));
  },{maxAttempts:3});}
 });
 const binding=Object.freeze({db,sdk,collections:STAGING_MARKETPLACE_COLLECTIONS,check});bindings.add(binding);return binding;
}
export function requireStagingMarketplaceBinding(value){if(!bindings.has(value))throw Error('Unverified staging binding');value.check();return value;}
