import {createBoundedRead} from '../features/shared/bounded-read.mjs';
import {projectServiceIntegrationResponse} from './service-integration-adapter.mjs';
const validRequest=r=>r&&Object.getPrototypeOf(r)===Object.prototype&&Object.keys(r).sort().join(',')==='enquiryId,expectedRevision,kind,providerId'&&
 ['profile','enquiry','conversation'].includes(r.kind)&&typeof r.providerId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(r.providerId)&&
 (r.kind==='profile'?r.enquiryId===null:typeof r.enquiryId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(r.enquiryId))&&Number.isSafeInteger(r.expectedRevision)&&r.expectedRevision>=0;
// INACTIVE server integration port, no endpoint/SDK/resources. authenticate must
// verify a token and derive canonical role/ID; readSnapshot must enforce trusted
// bounded queries, publication/membership freshness. Neither is implemented here.
function copyRequest(input){
 try{
  if(!input||Object.getPrototypeOf(input)!==Object.prototype)return null;
  const keys=Object.keys(input);if(keys.sort().join(',')!=='enquiryId,expectedRevision,kind,providerId')return null;
  const copy={};for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(input,key);if(!descriptor||!Object.hasOwn(descriptor,'value'))return null;copy[key]=descriptor.value;}
  return validRequest(copy)?Object.freeze(copy):null;
 }catch{return null;}
}
export function createServiceReadExecutor({enabled=false,authenticate,readSnapshot,timeoutMs=5000,schedule=setTimeout,cancel=clearTimeout}={}){
 return Object.freeze({async execute(request,{credential,signal}={}){
  if(enabled!==true)return {status:'unavailable'};
  request=copyRequest(request);
  if(!request||typeof readSnapshot!=='function'||signal?.aborted)return {status:'unavailable'};
  let result={status:'idle'};
  const reader=createBoundedRead({timeoutMs,schedule,cancel,onChange:state=>{result=state;},
   read:async(scope,{signal:readSignal})=>{
    let actor=null;
    if(scope.kind!=='profile'){
     if(typeof authenticate!=='function')throw new Error('Authentication unavailable');
     const identity=await authenticate(credential,{signal:readSignal});
     if(!identity||!['buyer','provider'].includes(identity.role)||typeof identity.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(identity.id))throw new Error('Authentication unavailable');
     actor=Object.freeze({role:identity.role,id:identity.id});
    }
    if(readSignal.aborted)throw new Error('Cancelled');
    return {actor,trusted:await readSnapshot(scope,{actor,signal:readSignal})};
   },
   project:(response,scope)=>{
    const projected=projectServiceIntegrationResponse(scope,response?.trusted,response?.actor,{enabled:true});
    return projected.ok?projected:null;
   }});
  const abort=()=>reader.clear();signal?.addEventListener('abort',abort,{once:true});
  try{await reader.load({...request});return result.status==='idle'?{status:'cancelled'}:result;}
  finally{signal?.removeEventListener('abort',abort);}
 }});
}
