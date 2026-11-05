import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createCloudinarySignedUpload} from './cloudinary-signed-upload.mjs';
import {createStagingCloudinaryHttpTransport} from './cloudinary-http-transport.mjs';
import {createStagingCloudinaryMultipartBridge} from './cloudinary-multipart-bridge.mjs';
import {createStagingTrustedImageProcessor} from './trusted-image-processor.mjs';
// Server composition only; explicit staging binding, supplied existing credentials
// and approved scan/authorization dependencies. No environment reads or defaults.
export function createStagingProviderSignedMediaPorts({enabled=false,binding,getCredentials,fetchImpl,authorizeUpload,authorizeAsset,scan,resolveDerivative,resolvePrivateDerivative,inspectDeletionSettlement,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({});const b=requireStagingMarketplaceBinding(binding);
 if(![getCredentials,fetchImpl,authorizeUpload,authorizeAsset,scan].every(fn=>typeof fn==='function'))throw Error('Provider media enforcement unavailable');
 const processor=createStagingTrustedImageProcessor({enabled:true,binding:b,scan}),signer=createCloudinarySignedUpload({enabled:true,getCredentials,authorizeUpload,now}),transport=createStagingCloudinaryHttpTransport({enabled:true,binding:b,getCredentials,fetchImpl,authorizeAsset,resolveDerivative,resolvePrivateDerivative,now});
 return Object.freeze({processor:{async decodeAndReencode(bytes,{surface,signal}={}){if(surface!=='profile')throw Error('Wrong Provider image surface');const p=await processor.process(bytes,{surface,signal});if(!p.ok||p.contentScanned!==true)throw Error('Image processing unavailable');return {bytes:p.bytes,contentType:p.contentType,width:p.width,height:p.height,metadataStripped:p.metadataStripped,contentScanned:p.contentScanned};}},createUploadProvider:({persistVerifiedUpload})=>createStagingCloudinaryMultipartBridge({enabled:true,binding:b,signer,getCredentials,sendMultipart:transport.sendMultipart,inspectAsset:transport.inspectAsset,persistVerifiedUpload,now}),inspectAsset:transport.inspectAsset,destroy:transport.destroy,inspectDeletionSettlement,readApprovedDerivative:transport.readApprovedDerivative,readPrivateDerivative:transport.readPrivateDerivative});
}
