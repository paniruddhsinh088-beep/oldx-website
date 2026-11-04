import {createStagingMarketplaceBinding,createEmulatorMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';
import {createStagingMarketplaceRepository} from '../../scripts/firebase-marketplace-repository.mjs';
import {createStagingMarketplaceEnforcement,createEmulatorMarketplaceEnforcement} from '../../scripts/provider-enforcement-adapters.mjs';
import {createStagingMarketplaceRate} from '../../scripts/staging-marketplace-rate.mjs';
import {createMarketplaceCommandHttp} from '../../scripts/marketplace-command-http.mjs';
const routes=Object.freeze({'/api/staging/marketplace/save':'save','/api/staging/marketplace/owner':'owner','/api/staging/marketplace/archive':'archive'});
const failure=status=>({status,headers:{'Cache-Control':'private, no-store'},body:{ok:false,error:{code:status===404?'NOT_FOUND':'ENFORCEMENT_UNAVAILABLE'}}});
// Server library only, NOT an api/ entrypoint. No environment/secret reads, SDK
// initialization, route deployment, media activation or default publication.
function runtime({enabled=false,projectId,deploymentEnvironment,adminFirestore,adminAuth,FieldValue,ratePolicy,createMediaBindings,publicationEnabled=false,now=Date.now,timeoutMs=5000}={},emulator=false){
 if(enabled!==true)return Object.freeze({handle:async()=>failure(503)});
 try{
  const expected=emulator?'demo-oldx-admin-runtime':'oldx-staging';
  if(emulator&&process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9098')throw Error('Unsafe Auth emulator');
  if(adminAuth?.app?.options?.projectId!==expected)throw Error('Wrong Auth scope');
  const binding=(emulator?createEmulatorMarketplaceBinding:createStagingMarketplaceBinding)({projectId,deploymentEnvironment,adminFirestore,FieldValue});
  const consumeAtomicQuota=createStagingMarketplaceRate({binding,policy:ratePolicy,now});
  const enforcement=(emulator?createEmulatorMarketplaceEnforcement:createStagingMarketplaceEnforcement)({enabled:true,projectId:expected,adminAuth,consumeAtomicQuota,now});
  const media=typeof createMediaBindings==='function'?createMediaBindings(binding):null;
  const http=createMarketplaceCommandHttp({enabled:true,emulatorTokenSyntax:emulator,now,timeoutMs,verifyFirebaseToken:enforcement.verifyFirebaseToken,consumeRateLimit:enforcement.consumeRateLimit,createRepository:({authenticate,timeoutMs})=>createStagingMarketplaceRepository({enabled:true,binding,authenticate,timeoutMs,now,photoPolicy:media?.photoPolicy,atomicPhotos:media?.atomicPhotos,publicationEnabled})});
  return Object.freeze({handle(path,request,context){return typeof path==='string'&&Object.hasOwn(routes,path)?http.handle(routes[path],request,context):Promise.resolve(failure(404));}});
 }catch{return Object.freeze({handle:async()=>failure(503)});}
}

// Pure non-secret configuration parser. Nothing reads process.env automatically.
export function stagingMarketplaceOptionsFromEnvironment(env={}){
 const disabled={enabled:false};
 if(env.OLDX_STAGING_COMMANDS_ENABLED!=='true'||env.VERCEL_ENV!=='preview'||env.OLDX_FIREBASE_ENV!=='staging'||env.OLDX_FIREBASE_PROJECT_ID!=='oldx-staging')return disabled;
 if(env.OLDX_STAGING_PUBLICATION_ENABLED!==undefined&&!['true','false'].includes(env.OLDX_STAGING_PUBLICATION_ENABLED))return disabled;
 const names=['OLDX_RATE_WINDOW_MS','OLDX_RATE_ACTOR_LIMIT','OLDX_RATE_GLOBAL_LIMIT'];
 if(names.some(k=>typeof env[k]!=='string'||!/^\d{1,7}$/.test(env[k])||Number(env[k])<1))return disabled;
 const [windowMs,actorLimit,globalLimit]=names.map(k=>Number(env[k]));if(windowMs<1000||windowMs>600000||actorLimit>globalLimit)return disabled;
 return {enabled:true,projectId:'oldx-staging',deploymentEnvironment:'preview',publicationEnabled:env.OLDX_STAGING_PUBLICATION_ENABLED==='true',ratePolicy:{windowMs,actorLimit,globalLimit}};
}

export const createStagingMarketplaceRuntime=options=>runtime(options);
export const createEmulatorMarketplaceRuntime=options=>runtime(options,true);
