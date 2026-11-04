import {createPrivateConversationHttp} from './product-conversation-http.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const limits={product:{bytes:3*1024*1024,count:6},store:{bytes:3*1024*1024,count:1},provider:{bytes:2*1024*1024,count:1}};
// Inactive Firebase-authenticated authorization handler, NOT a deployed route.
// Returns a proxy-required intent only, never a raw reusable Cloudinary signature.
// Actual bytes must pass the existing ownership/quota/lease/decode/scan pipeline.
export function createCloudinaryUploadHttp({readOwnedParent,...options}={}){
 return createPrivateConversationHttp({...options,contract:{prefix:'media.upload.',keys:{authorize:['requestId','kind','parentId','expectedParentRevision','byteSize','contentType','count']},projection:(_,value)=>{const v=copyRecord(value,['ok','kind','parentId','revision','mode']);return v?.ok===true&&Object.hasOwn(limits,v.kind)&&safeId(v.parentId)&&Number.isSafeInteger(v.revision)&&v.revision>0&&v.mode==='server-proxy'?v:null;}},createRepository:({authenticate})=>({async authorize(request,{signal}={}){
  const p=Object.hasOwn(limits,request.kind)?limits[request.kind]:null;if(!p||!safeId(request.requestId)||!safeId(request.parentId)||!Number.isSafeInteger(request.expectedParentRevision)||request.expectedParentRevision<1||!Number.isSafeInteger(request.byteSize)||request.byteSize<1||request.byteSize>p.bytes||!Number.isInteger(request.count)||request.count<1||request.count>p.count||!['image/jpeg','image/png','image/webp'].includes(request.contentType))return {ok:false,code:'INVALID_REQUEST'};
  if(typeof readOwnedParent!=='function')return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};const identity=await authenticate(),row=copyRecord(await readOwnedParent({kind:request.kind,parentId:request.parentId,actorUid:identity.uid},{signal}),['kind','id','ownerUid','revision','suspended']);if(signal?.aborted||!row||row.kind!==request.kind||row.id!==request.parentId||row.ownerUid!==identity.uid||row.suspended!==false)return {ok:false,code:'DENIED'};if(row.revision!==request.expectedParentRevision)return {ok:false,code:'REVISION_CONFLICT'};
  return {ok:true,kind:row.kind,parentId:row.id,revision:row.revision,mode:'server-proxy'};
 }})});
}
