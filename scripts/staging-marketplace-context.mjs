import {PROVIDER_SCHEMA_V1} from './provider-schema-v1.mjs';
import {safeId} from './isolated-firestore-context.mjs';
export const STAGING_MARKETPLACE_COLLECTIONS=Object.freeze({actors:'marketplaceActors_v1',privateRecords:'marketplacePrivate_v1',publicViews:'marketplacePublic_v1',owners:'marketplaceOwners_v1',generations:'marketplaceGenerations_v1',receipts:'marketplaceReceipts_v1',audits:'marketplaceAudit_v1'});
export const STAGING_MEDIA_COLLECTIONS=Object.freeze({assets:'marketplaceMediaAssets_v1',associations:'marketplaceMediaAssociations_v1',reviews:'marketplaceMediaReviews_v1',publications:'marketplaceMediaPublications_v1',permissions:'marketplaceMediaPermissions_v1',generations:'marketplaceMediaGenerations_v1',receipts:'marketplaceMediaReceipts_v1',audits:'marketplaceMediaAudit_v1'});
export const STAGING_MEDIA_JOURNAL=Object.freeze({assets:STAGING_MEDIA_COLLECTIONS.assets,quotas:'marketplaceMediaQuotas_v1',operations:'marketplaceMediaOperations_v1',audits:'marketplaceMediaJournalAudit_v1'});
export const STAGING_MEDIA_REFERENCES=Object.freeze({assets:STAGING_MEDIA_COLLECTIONS.assets,associations:STAGING_MEDIA_COLLECTIONS.associations,receipts:'marketplaceMediaReferenceReceipts_v1',audits:'marketplaceMediaReferenceAudit_v1'});
export const STAGING_RATE_COLLECTION='marketplaceRateLimits_v1';
const bindings=new WeakSet();
// Native Admin API normalization only; never initializes an app/credential/client.
// Existing demo SDK context remains unchanged and never accepts this binding.
function binding({adminFirestore,FieldValue,deploymentEnvironment,projectId}={},emulator=false){
 const expected=emulator?'demo-oldx-admin-runtime':'oldx-staging';
 const check=()=>{if(emulator?(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8088'||adminFirestore?._settings?.servicePath!=='127.0.0.1'||adminFirestore?._settings?.port!==8088||adminFirestore?._settings?.ssl!==false):(!!process.env.FIRESTORE_EMULATOR_HOST||!!process.env.FIREBASE_AUTH_EMULATOR_HOST))throw Error('Unsafe SDK transport');
 if(deploymentEnvironment!=='preview'||projectId!==expected||adminFirestore?.projectId!==expected||typeof adminFirestore.collection!=='function'||typeof adminFirestore.runTransaction!=='function'||typeof FieldValue?.serverTimestamp!=='function')throw Error('Staging binding unavailable');};check();
 const allowed=new Set([...Object.values(PROVIDER_SCHEMA_V1.collections),...Object.values(STAGING_MARKETPLACE_COLLECTIONS),...Object.values(STAGING_MEDIA_COLLECTIONS),...Object.values(STAGING_MEDIA_JOURNAL),...Object.values(STAGING_MEDIA_REFERENCES),STAGING_RATE_COLLECTION]);
 const references=new WeakMap(),db=adminFirestore;
 const native=ref=>{check();const value=references.get(ref);if(!value)throw Error('Unbound staging reference');return value;};
 const sdk=Object.freeze({
  doc(database,collection,id){check();if(database!==db||!allowed.has(collection)||!safeId(id))throw Error('Staging reference denied');const ref=Object.freeze({path:collection+'/'+id});references.set(ref,db.collection(collection).doc(id));return ref;},
  serverTimestamp(){check();return FieldValue.serverTimestamp();},
  async runTransaction(database,callback,options){check();if(database!==db||options?.maxAttempts!==3)throw Error('Staging transaction denied');return db.runTransaction(async tx=>{
   check();return callback(Object.freeze({async get(ref){const snapshot=await tx.get(native(ref));check();if(typeof snapshot.exists!=='boolean')throw Error('Invalid Admin snapshot');return {exists:()=>snapshot.exists,data:()=>snapshot.data()};},set(ref,value){check();tx.set(native(ref),value);},delete(ref){check();tx.delete(native(ref));}}));
  },{maxAttempts:3});}
 });
 const binding=Object.freeze({db,sdk,collections:STAGING_MARKETPLACE_COLLECTIONS,providerCollections:PROVIDER_SCHEMA_V1.collections,mediaCollections:STAGING_MEDIA_COLLECTIONS,journalCollections:STAGING_MEDIA_JOURNAL,referenceCollections:STAGING_MEDIA_REFERENCES,check});bindings.add(binding);return binding;
}
export function requireStagingMarketplaceBinding(value){if(!bindings.has(value))throw Error('Unverified staging binding');value.check();return value;}

export const createStagingMarketplaceBinding=options=>binding(options);
export const createEmulatorMarketplaceBinding=options=>binding(options,true);
