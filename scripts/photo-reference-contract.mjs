import {classifyProductImageReferences} from './classify-product-image-references.mjs';
const surfaces=Object.freeze({product:6,store:1,'provider-profile':1,'provider-service':6});
// Inactive compatibility descriptor. Never fetches/migrates/deletes/changes a URL.
// Legacy classifications are NOT authorization, public projection or asset proof.
export function preparePhotoReferences(surface,values){
 if(typeof surface!=='string'||!Object.hasOwn(surfaces,surface)||!Array.isArray(values)||values.length>surfaces[surface])return {ok:false,code:'INVALID_PHOTOS'};
 const refs=[];
 for(const value of values){
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){const keys=Reflect.ownKeys(value);if(keys.length!==2||!keys.includes('kind')||!keys.includes('imageId')||keys.some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'))||value.kind!=='managed'||typeof value.imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(value.imageId))return {ok:false,code:'INVALID_PHOTOS'};refs.push({kind:'managed',imageId:value.imageId,requiresTrustedResolution:true});continue;}
  const classification=classifyProductImageReferences([value]).entries[0].classification;
  if(classification==='invalid_reference')return {ok:false,code:'INVALID_PHOTOS'};
  refs.push({kind:'legacy',value,classification,managed:false,canDeleteRemote:false,requiresVisibilityReview:true});
 }
 return {ok:true,proposalOnly:true,surface,references:refs};
}
