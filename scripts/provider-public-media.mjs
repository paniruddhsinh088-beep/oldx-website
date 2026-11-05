import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {requireProviderMediaRelease} from './provider-media-release.mjs';
import {createApprovedProviderMediaByteDelivery} from './approved-media-byte-delivery.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
const no=()=>({ok:false,code:'MEDIA_UNAVAILABLE'}),positive=v=>Number.isSafeInteger(v)&&v>0;
// UI is scoped to the public dataset generation. Resolve the individual Provider
// publication epoch on the server; never conflate it with the dataset generation.
export function createStagingProviderPublicMedia({enabled=false,binding,release,readApprovedDerivative,consumeRateLimit,timeoutMs=5000}={}){
 if(enabled!==true)return Object.freeze({manifest:async()=>no(),bytes:async()=>no()});const b=requireStagingMarketplaceBinding(binding);requireProviderMediaRelease(release,b);
 const gateway=createApprovedProviderMediaByteDelivery({enabled:true,contract:{publicPhotos:release.photos},readApprovedDerivative,consumeRateLimit,timeoutMs});
 async function current(input,context){return b.sdk.runTransaction(b.db,async tx=>{context.checkpoint();const g=await tx.get(b.sdk.doc(b.db,b.providerCollections.generations,'current')),p=await tx.get(b.sdk.doc(b.db,b.providerCollections.publications,input.parentId));context.checkpoint();if(!g.exists()||g.data().value!==input.expectedParentRevision||!p.exists()||p.data().providerId!==input.parentId||p.data().published!==true||!positive(p.data().publicationEpoch)||p.data().publicationEpoch>g.data().value)return null;return p.data().publicationEpoch;},{maxAttempts:3});}
 async function run(operation,request,{signal}={}){const r=copyRecord(request,operation==='manifest'?['kind','parentId','expectedParentRevision']:['kind','parentId','expectedParentRevision','expectedPhotoRevision','imageId']);if(!r||r.kind!=='provider'||!safeId(r.parentId)||!positive(r.expectedParentRevision)||operation==='bytes'&&(!positive(r.expectedPhotoRevision)||typeof r.imageId!=='string'||!(/^[A-Za-z0-9_-]{20,80}$/).test(r.imageId))||typeof consumeRateLimit!=='function')return no();
  return runVerifiedOperation({authenticate:()=>({uid:'public-provider-media'}),signal,timeoutMs,run:async context=>{{const rate=copyRecord(await consumeRateLimit({operation:'provider.media.manifest'},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed']);context.checkpoint();if(rate?.allowed!==true)return no();}const epoch=await current(r,context);if(!epoch)return no();const result=operation==='manifest'?await release.photos({...r,expectedParentRevision:epoch},{signal:context.signal}):await gateway.read({...r,expectedParentRevision:epoch},{signal:context.signal});context.checkpoint();if(!result?.ok||await current(r,context)!==epoch)return no();return operation==='manifest'?{...result,parentRevision:r.expectedParentRevision}:result;}});
 }
 return Object.freeze({manifest:(r,c)=>run('manifest',r,c),bytes:(r,c)=>run('bytes',r,c)});
}
