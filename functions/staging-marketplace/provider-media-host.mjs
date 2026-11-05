import {requireStagingMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';
import {createStagingMarketplaceEnforcement,createEmulatorMarketplaceEnforcement} from '../../scripts/provider-enforcement-adapters.mjs';
import {createStagingMarketplaceRate} from '../../scripts/staging-marketplace-rate.mjs';
import {createStagingProviderMediaRelease} from '../../scripts/provider-media-release.mjs';
import {createStagingProviderMediaAuthorization} from '../../scripts/provider-media-authorization.mjs';
import {createStagingProviderSignedMediaPorts} from '../../scripts/provider-signed-media-ports.mjs';
import {createStagingProviderPublicMedia} from '../../scripts/provider-public-media.mjs';
import {createStagingProviderMediaHttp} from '../../scripts/provider-media-http.mjs';
import {createStagingFirebaseProviderRepository} from '../../scripts/firebase-provider-repository.mjs';
import {createProviderHttpComposition} from '../../scripts/provider-http-composition.mjs';
import {createStagingPublicProviderRepository} from '../../scripts/firebase-provider-public-read.mjs';
const failure=()=>({status:503,headers:{'Cache-Control':'private, no-store'},body:{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}}});
// Source-only host composition. No endpoint/app/credential/environment startup.
// Media, public delivery, discovery and publication all require explicit gates.
function host({enabled=false,binding,adminAuth,ratePolicy,getCredentials,fetchImpl,scan,catalog,readCursor,issueCursor,publicationEnabled=false,publicDeliveryEnabled=false,publicReadsEnabled=false,inspectDeletionSettlement,now=Date.now}={},emulator=false){
 const disabled=()=>Object.freeze({upload:async()=>failure(),command:async()=>failure(),providerCommands:Object.freeze({handle:async()=>failure()})});if(enabled!==true)return disabled();
 try{
  const b=requireStagingMarketplaceBinding(binding),project=emulator?'demo-oldx-admin-runtime':'oldx-staging';if(b.db.projectId!==project||adminAuth?.app?.options?.projectId!==project)return disabled();
  const rate=createStagingMarketplaceRate({binding:b,policy:ratePolicy,now}),verify=(emulator?createEmulatorMarketplaceEnforcement:createStagingMarketplaceEnforcement)({enabled:true,projectId:project,adminAuth,now}).verifyFirebaseToken;
  const release=createStagingProviderMediaRelease({enabled:true,binding:b}),authorization=createStagingProviderMediaAuthorization({enabled:true,binding:b,release}),ports=createStagingProviderSignedMediaPorts({enabled:true,binding:b,getCredentials,fetchImpl,scan,...authorization,resolveDerivative:release.resolveDerivative,inspectDeletionSettlement,now});
  const publicRate=(_input,context)=>rate({actorUid:'public-provider-media'},context),publicMedia=createStagingProviderPublicMedia({enabled:publicDeliveryEnabled===true,binding:b,release,readApprovedDerivative:ports.readApprovedDerivative,consumeRateLimit:publicRate});
  const media=createStagingProviderMediaHttp({enabled:true,binding:b,verifyFirebaseToken:verify,consumeRateLimit:rate,providerPorts:ports,publicMedia,now,emulatorTokenSyntax:emulator});
  const repository=createStagingFirebaseProviderRepository({enabled:true,binding:b,...(publicationEnabled===true?{mediaRelease:release}:{})});
  const role=async(uid,{signal}={})=>b.sdk.runTransaction(b.db,async tx=>{if(signal?.aborted)throw Error('Cancelled');const actor=await tx.get(b.sdk.doc(b.db,b.providerCollections.actors,uid)),owner=await tx.get(b.sdk.doc(b.db,b.providerCollections.owners,uid));const a=actor.exists()?actor.data():null,o=owner.exists()?owner.data():null;return {uid,active:a?.uid===uid&&a.canWrite===true&&a.suspended===false,role:o?.ownerUid===uid?'provider':'member'};},{maxAttempts:3});
  // Existing HTTP composition derives canonical owner IDs during its atomic draft
  // transaction. Opaque ID candidates never encode an Auth UID.
  const commands=createProviderHttpComposition({enabled:true,verifyFirebaseToken:verify,resolveProviderRole:role,consumeRateLimit:async(key,context)=>{const r=await rate(key,context);return {allowed:r.allowed,retryAfterSeconds:r.allowed?0:Math.max(1,Math.min(3600,Math.ceil(ratePolicy.windowMs/1000)))};},draft:{repository,providerIdForActor:()=> 'sp_'+globalThis.crypto.randomUUID()},bootstrap:{repository},publication:{repository,catalog,mandatoryPhotos:true},now});
  return Object.freeze({...media,release,providerCommands:commands,publicReads:createStagingPublicProviderRepository({enabled:publicReadsEnabled===true,binding:b,catalog,readCursor,issueCursor})});
 }catch{return disabled();}
}
export const createStagingProviderMediaHost=options=>host(options);
export const createEmulatorProviderMediaHost=options=>host(options,true);
