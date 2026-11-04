import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const CLOUD='tfizvbzc',ttl=60000,fail=()=>({ok:false,code:'UPLOAD_UNAVAILABLE'});
const digest=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const canonical=f=>['overwrite','public_id','timestamp','type'].map(k=>k+'='+String(f[k])).join('&');
const mac=(g,secret)=>createHmac('sha256',secret).update('oldx-server-upload-v1\n'+JSON.stringify([g.actorUid,g.digest,g.byteSize,g.expiresAt,g.fields.api_key,g.fields.signature])).digest('hex');
function image(input){const r=copyRecord(input,['bytes','publicId','resourceType','deliveryType','overwrite']);return r&&r.bytes instanceof Uint8Array&&r.bytes.length>=12&&r.bytes.length<=3*1024*1024&&Buffer.from(r.bytes.slice(0,4)).toString()==='RIFF'&&Buffer.from(r.bytes.slice(8,12)).toString()==='WEBP'&&typeof r.publicId==='string'&&/^oldx\/quarantine\/[A-Za-z0-9_-]{20,80}$/.test(r.publicId)&&r.resourceType==='image'&&r.deliveryType==='authenticated'&&r.overwrite===false?r:null;}
// SERVER-ONLY request signing port for the existing processed/quarantine pipeline.
// No HTTP route/fetch/provider call. Never serialize this grant to a browser.
// Cloudinary does not sign file bytes; our separate server envelope binds them.
export function createCloudinarySignedUpload({enabled=false,getCredentials,authorizeUpload,now=Date.now}={}){
 const credentials=async()=>{if(typeof getCredentials!=='function')return null;const c=copyRecord(await getCredentials(),['cloudName','apiKey','apiSecret']);return c?.cloudName===CLOUD&&typeof c.apiKey==='string'&&/^[0-9]{5,32}$/.test(c.apiKey)&&typeof c.apiSecret==='string'&&c.apiSecret.length>=16&&c.apiSecret.length<=256?c:null;};
 return Object.freeze({async signForServer(input,{actorUid,signal}={}){try{
  if(enabled!==true||signal?.aborted||!safeId(actorUid)||typeof authorizeUpload!=='function')return fail();const r=image(input);if(!r)return fail();const bytes=new Uint8Array(r.bytes),bodyDigest=digest(bytes);
  if(await authorizeUpload({actorUid,publicId:r.publicId,byteSize:bytes.length,digest:bodyDigest},{signal})!==true)return fail();const c=await credentials();if(!c||signal?.aborted)return fail();
  const clock=now();if(!Number.isSafeInteger(clock)||clock<0)return fail();const timestamp=Math.floor(clock/1000),fields={overwrite:false,public_id:r.publicId,timestamp,type:'authenticated'};fields.api_key=c.apiKey;fields.signature=digest(Buffer.from(canonical(fields)+c.apiSecret));
  const grant={actorUid,digest:bodyDigest,byteSize:bytes.length,expiresAt:timestamp*1000+ttl,fields};grant.mac=mac(grant,c.apiSecret);return {ok:true,grant};
 }catch{return fail();}},async verifyForServer(grant,input,{actorUid,signal}={}){try{
  if(enabled!==true||signal?.aborted||!safeId(actorUid))return false;const g=copyRecord(grant,['actorUid','digest','byteSize','expiresAt','fields','mac']),f=copyRecord(g?.fields,['overwrite','public_id','timestamp','type','api_key','signature']),r=image(input),c=await credentials(),clock=now();if(!Number.isSafeInteger(clock)||clock<0||!g||!f||!r||!c||g.actorUid!==actorUid||g.digest!==digest(r.bytes)||g.byteSize!==r.bytes.length||!Number.isSafeInteger(f.timestamp)||f.timestamp*1000>clock||g.expiresAt!==f.timestamp*1000+ttl||g.expiresAt<=clock||f.public_id!==r.publicId||f.type!=='authenticated'||f.overwrite!==false||f.api_key!==c.apiKey||!equal(f.signature,digest(Buffer.from(canonical(f)+c.apiSecret)))||!equal(g.mac,mac(g,c.apiSecret)))return false;
  return typeof authorizeUpload==='function'&&await authorizeUpload({actorUid,publicId:r.publicId,byteSize:r.bytes.length,digest:g.digest},{signal})===true&&!signal?.aborted&&Number.isSafeInteger(now())&&now()<g.expiresAt;
 }catch{return false;}}});
}
