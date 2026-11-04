import {createStagingMarketplaceRuntime,stagingMarketplaceOptionsFromEnvironment} from './runtime.mjs';
import {createStagingMarketplaceMedia} from '../../scripts/staging-marketplace-media.mjs';
import {createMarketplaceFetchHandler} from './vercel-handler.mjs';
// Inactive deployment artifact bootstrap, not imported by the static site.
// Uses existing runtime credentials only AFTER explicit staging gates. Never
// provisions credentials. Publication stays closed pending provider inspection.
export function createStagingHandler({operation,env={},loadSdk=async()=>{
 const [app,auth,firestore]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')]);return {app,auth,firestore};
}}={}){
 const parsed=stagingMarketplaceOptionsFromEnvironment(env);
 const options={...parsed,enabled:parsed.enabled===true&&parsed.publicationEnabled!==true&&!env.FIRESTORE_EMULATOR_HOST&&!env.FIREBASE_AUTH_EMULATOR_HOST};
 let runtime;
 return createMarketplaceFetchHandler({operation,options,loadRuntime:async()=>{
  if(!runtime)runtime=(async()=>{
   const {app,auth,firestore}=await loadSdk();
   const name='oldx-staging-marketplace-v1';
   const existing=app.getApps().find(value=>value.name===name);
   if(existing&&existing.options.projectId!=='oldx-staging')throw Error('Invalid project');
   const instance=existing??app.initializeApp({projectId:'oldx-staging',credential:app.applicationDefault()},name);
   return createStagingMarketplaceRuntime({...options,adminAuth:auth.getAuth(instance),adminFirestore:firestore.getFirestore(instance),FieldValue:firestore.FieldValue,createMediaBindings:binding=>createStagingMarketplaceMedia({enabled:true,binding})});
  })().catch(error=>{runtime=undefined;throw error;});
  return runtime;
 }});
}
