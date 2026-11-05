import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createHash,timingSafeEqual} from 'node:crypto';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {parseBoundedJson} from './bounded-json.mjs';

const URL='https://api.cloudinary.com/v1_1/tfizvbzc/image/upload';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const unavailable=()=>{throw new Error('Upload unconfirmed');};

// SERVER ONLY. No fetch/default transport. Compose ONLY behind the existing
// lifecycle's atomic markUploadAttempt; that journal owns retries/reconciliation.
// inspectAsset must independently attest stored bytes (including their digest),
// not echo upload response metadata. Provider response signatures cover only ID/version.
function buildCloudinaryMultipartBridge({enabled=false,mode,signer,getCredentials,sendMultipart,inspectAsset,persistVerifiedUpload,onProgress,now=Date.now}={},stagingBinding=null){
 const active=enabled===true&&(stagingBinding!==null||mode==='isolated-test');
 const receipts=new WeakMap();
 const check=context=>{
  stagingBinding?.check();
  if(!active||!safeId(context?.actorUid)||typeof context?.checkpoint!=='function'||context.signal?.aborted)unavailable();
  context.checkpoint();
 };
 return Object.freeze({
  async uploadProcessed(input,context){
   check(context);
   if(typeof signer?.signForServer!=='function'||typeof signer.verifyForServer!=='function'||![getCredentials,sendMultipart,inspectAsset].every(f=>typeof f==='function'))unavailable();
   const r=copyRecord(input,['bytes','publicId','resourceType','deliveryType','overwrite']);
   if(!r||!(r.bytes instanceof Uint8Array)||r.bytes.length>3*1024*1024)unavailable();
   // Snapshot before awaiting any injected code; later caller mutation cannot alter the file.
   const upload={...r,bytes:new Uint8Array(r.bytes)},auth={actorUid:context.actorUid,signal:context.signal};
   const signed=await signer.signForServer(upload,auth);check(context);
   if(signed?.ok!==true)unavailable();
   const credentials=copyRecord(await getCredentials(),['cloudName','apiKey','apiSecret']);check(context);
   if(credentials?.cloudName!=='tfizvbzc'||credentials.apiKey!==signed.grant?.fields?.api_key||typeof credentials.apiSecret!=='string'||credentials.apiSecret.length<16||credentials.apiSecret.length>256)unavailable();
   const body=new FormData();
   for(const key of ['overwrite','public_id','timestamp','type','api_key','signature'])body.set(key,String(signed.grant.fields[key]));
   body.set('file',new Blob([upload.bytes],{type:'image/webp'}),'processed.webp');
   let progress=0,finished=false;
   const report=value=>{if(finished||context.signal?.aborted||!Number.isInteger(value)||value<progress||value>100)return;progress=value;try{onProgress?.(value);}catch{/* UI feedback never changes a committed upload outcome. */}};
   if(await signer.verifyForServer(signed.grant,upload,auth)!==true)unavailable();check(context);
   report(0);check(context);
   let response;
   try{
    response=await sendMultipart({url:URL,method:'POST',body,maxResponseBytes:16384},{actorUid:context.actorUid,signal:context.signal,deadlineAt:context.deadlineAt,onProgress:event=>{
     const p=copyRecord(event,['loaded','total']);
     if(p&&p.total===upload.bytes.length&&Number.isSafeInteger(p.loaded)&&p.loaded>=0&&p.loaded<=p.total)report(Math.min(99,Math.floor(p.loaded*100/p.total)));
    }});
   }finally{finished=true;}
   check(context);
   const transport=copyRecord(response,['status','body']);
   if(transport?.status!==200)unavailable();
   // Transport must return this bounded normalized provider DTO, never URLs or secrets.
   const parsed=parseBoundedJson(transport.body),v=parsed.ok?copyRecord(parsed.value,['asset_id','public_id','version','signature','resource_type','type','format','bytes','width','height']):null;
   if(!v||!safeId(v.asset_id)||v.public_id!==upload.publicId||!Number.isSafeInteger(v.version)||v.version<1||v.resource_type!=='image'||v.type!=='authenticated'||v.format!=='webp'||v.bytes!==upload.bytes.length||!Number.isSafeInteger(v.width)||v.width<1||v.width>8192||!Number.isSafeInteger(v.height)||v.height<1||v.height>8192||v.width*v.height>16000000||!same(v.signature,hash('public_id='+v.public_id+'&version='+v.version+credentials.apiSecret)))unavailable();
   const digest=hash(upload.bytes);
   const proof=copyRecord(await inspectAsset({assetId:v.asset_id,publicId:v.public_id,version:v.version},{actorUid:context.actorUid,signal:context.signal,deadlineAt:context.deadlineAt}),['assetId','publicId','version','resourceType','deliveryType','format','byteSize','width','height','digest']);
   check(context);
   if(!proof||proof.assetId!==v.asset_id||proof.publicId!==v.public_id||proof.version!==v.version||proof.resourceType!=='image'||proof.deliveryType!=='authenticated'||proof.format!=='webp'||proof.byteSize!==upload.bytes.length||proof.width!==v.width||proof.height!==v.height||proof.digest!==digest||await signer.verifyForServer(signed.grant,upload,auth)!==true)unavailable();
   check(context);
   if(persistVerifiedUpload!==undefined&&(typeof persistVerifiedUpload!=='function'||await persistVerifiedUpload(proof,context)!==true))unavailable();check(context);
   const result=Object.freeze({assetId:v.asset_id});
   receipts.set(result,{actorUid:context.actorUid,publicId:upload.publicId,byteSize:upload.bytes.length,expiresAt:signed.grant.expiresAt,upload,grant:signed.grant});
   try{onProgress?.(100);}catch{/* No private metadata in progress. */}
   return result;
  },
  async verifyUploadResult(result,expected,context){
   try{
    check(context);const receipt=receipts.get(result),e=copyRecord(expected,['publicId','deliveryType','byteSize']),clock=now();
    if(!receipt||!e||!Number.isSafeInteger(clock)||clock<0||clock>=receipt.expiresAt||receipt.actorUid!==context.actorUid||receipt.publicId!==e.publicId||receipt.byteSize!==e.byteSize||e.deliveryType!=='authenticated')return false;
    const verified=await signer.verifyForServer(receipt.grant,receipt.upload,{actorUid:context.actorUid,signal:context.signal});check(context);return verified===true;
   }catch{return false;}
  }
 });
}

export const createCloudinaryMultipartBridge=options=>buildCloudinaryMultipartBridge(options);
export function createStagingCloudinaryMultipartBridge(options={}){
 if(options.enabled!==true)return buildCloudinaryMultipartBridge({});
 const binding=requireStagingMarketplaceBinding(options.binding);return buildCloudinaryMultipartBridge(options,binding);
}
