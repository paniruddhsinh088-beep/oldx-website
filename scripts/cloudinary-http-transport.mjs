import {createHash,timingSafeEqual} from 'node:crypto';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {parseBoundedJson} from './bounded-json.mjs';
const API='https://api.cloudinary.com/v1_1/tfizvbzc',CDN='https://res.cloudinary.com/tfizvbzc/image/authenticated';
const MAX=3*1024*1024,JSON_MAX=16384;
const fail=()=>{throw Error('Media transport unconfirmed');};
const sha=value=>createHash('sha256').update(value).digest('hex');
const positive=v=>Number.isSafeInteger(v)&&v>0;
const publicId=v=>typeof v==='string'&&/^oldx\/quarantine\/[A-Za-z0-9_-]{20,80}$/.test(v);
const webp=b=>b instanceof Uint8Array&&b.length>=12&&b.length<=MAX&&Buffer.from(b.subarray(0,4)).toString()==='RIFF'&&Buffer.from(b.subarray(8,12)).toString()==='WEBP';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const uploadKeys=['asset_id','public_id','version','signature','resource_type','type','format','bytes','width','height'];
const metadataKeys=uploadKeys.filter(key=>key!=='signature');
// Server-only HTTP implementation with an injected Fetch-compatible dependency.
// Default OFF and isolated-test ONLY: no global fetch, SDK startup or environment
// credentials. Reuse journal leases: this module NEVER retries a mutating call.
export function createCloudinaryHttpTransport({enabled=false,mode,fetchImpl,getCredentials,authorizeAsset,resolveDerivative,now=Date.now}={}){
 const active=enabled===true&&mode==='isolated-test';
 async function credentials(){
  if(!active||typeof fetchImpl!=='function'||typeof getCredentials!=='function')fail();
  const c=copyRecord(await getCredentials(),['cloudName','apiKey','apiSecret']);
  if(c?.cloudName!=='tfizvbzc'||typeof c.apiKey!=='string'||!/^\d{5,32}$/.test(c.apiKey)||typeof c.apiSecret!=='string'||c.apiSecret.length<16||c.apiSecret.length>256)fail();return c;
 }
 async function request(url,init,maxBytes,context={}){
  const clock=now(),remaining=context.deadlineAt-clock;
  if(!active||typeof fetchImpl!=='function'||!Number.isSafeInteger(clock)||!Number.isSafeInteger(context.deadlineAt)||remaining<=0||remaining>30000||context.signal?.aborted)fail();
  const controller=new AbortController(),abort=()=>controller.abort();let rejectAbort;
  const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(Error('Media transport unconfirmed'));});
  controller.signal.addEventListener('abort',rejectAbort,{once:true});
  context.signal?.addEventListener('abort',abort,{once:true});if(context.signal?.aborted)abort();
  const timer=setTimeout(abort,Math.min(5000,remaining));let reader;
  try{
   const response=await Promise.race([fetchImpl(url,{...init,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal}),cancelled]);
   if(controller.signal.aborted||response.redirected||!Number.isInteger(response.status)||response.status<100||response.status>599)fail();
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))fail();
   const encoding=response.headers.get('content-encoding');if(encoding&&encoding!=='identity')fail();
   reader=response.body?.getReader();const chunks=[];let size=0;
   if(reader)while(true){const {done,value}=await Promise.race([reader.read(),cancelled]);if(done)break;if(!(value instanceof Uint8Array))fail();size+=value.length;if(size>maxBytes)fail();chunks.push(new Uint8Array(value));}
   if(controller.signal.aborted||now()>=context.deadlineAt)fail();
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   return {status:response.status,contentType:response.headers.get('content-type'),bytes};
  }catch{fail();}finally{clearTimeout(timer);context.signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);if(reader)void reader.cancel().catch(()=>{});controller.abort();}
 }
 function json(response){
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.contentType??''))fail();const parsed=parseBoundedJson(response.bytes,{maxBytes:JSON_MAX});if(!parsed.ok)fail();return parsed.value;
 }
 const basic=c=>({'Authorization':'Basic '+Buffer.from(c.apiKey+':'+c.apiSecret).toString('base64'),'Accept':'application/json','Accept-Encoding':'identity'});
 async function authorized(action,input,context){if(!active||typeof authorizeAsset!=='function'||await authorizeAsset({action,...input},context)!==true||context?.signal?.aborted)fail();}
 function identity(input){const r=copyRecord(input,['assetId','publicId','version']);if(!r||!safeId(r.assetId)||!publicId(r.publicId)||!positive(r.version))fail();return r;}
 function metadata(value,expected){
  const v=Object.fromEntries(metadataKeys.map(key=>[key,value[key]]));
  if(v.asset_id!==expected.assetId||v.public_id!==expected.publicId||v.version!==expected.version||v.resource_type!=='image'||v.type!=='authenticated'||v.format!=='webp'||!positive(v.bytes)||v.bytes>MAX||!positive(v.width)||v.width>8192||!positive(v.height)||v.height>8192||v.width*v.height>16000000)fail();return v;
 }
 async function lookup(expected,c,context){
  const response=await request(`${API}/resources/${encodeURIComponent(expected.assetId)}`,{method:'GET',headers:basic(c)},JSON_MAX,context);
  if(response.status!==200)fail();return metadata(json(response),expected);
 }
 async function storedBytes(expected,c,context){
  // Version is part of the signed path. Never follow a URL from provider metadata.
  const path=`v${expected.version}/${expected.publicId}.webp`;
  const signature=createHash('sha256').update(path+c.apiSecret).digest('base64url').slice(0,8);
  const response=await request(`${CDN}/s--${signature}--/${path}`,{method:'GET',headers:{Accept:'image/webp','Accept-Encoding':'identity'}},MAX,context);
  if(response.status!==200||response.contentType!=='image/webp'||!webp(response.bytes))fail();return response.bytes;
 }
 async function inspect(input,context){
  const r=identity(input);await authorized('inspect',r,context);const c=await credentials(),before=await lookup(r,c,context),bytes=await storedBytes(r,c,context),after=await lookup(r,c,context);
  if(JSON.stringify(before)!==JSON.stringify(after)||bytes.length!==before.bytes)fail();await authorized('inspect',r,context);
  return {assetId:r.assetId,publicId:r.publicId,version:r.version,resourceType:'image',deliveryType:'authenticated',format:'webp',byteSize:bytes.length,width:before.width,height:before.height,digest:sha(bytes),bytes};
 }
 return Object.freeze({
  async sendMultipart(input,context){
   const r=copyRecord(input,['url','method','body','maxResponseBytes']);
   if(!active||!r||r.url!==API+'/image/upload'||r.method!=='POST'||r.maxResponseBytes!==JSON_MAX||!(r.body instanceof FormData))fail();
   const expected=['overwrite','public_id','timestamp','type','api_key','signature','file'];
   if([...r.body.keys()].sort().join(',')!==expected.sort().join(','))fail();
   const fields=Object.fromEntries(['overwrite','public_id','timestamp','type','api_key','signature'].map(k=>[k,r.body.get(k)])),file=r.body.get('file');
   if(fields.overwrite!=='false'||fields.type!=='authenticated'||!publicId(fields.public_id)||typeof fields.timestamp!=='string'||!/^\d{1,12}$/.test(fields.timestamp)||!(file instanceof Blob)||file.type!=='image/webp'||file.size<12||file.size>MAX)fail();
   const c=await credentials(),clock=now(),timestamp=Number(fields.timestamp)*1000;
   const canonical=['overwrite','public_id','timestamp','type'].map(k=>k+'='+fields[k]).join('&');
   if(fields.api_key!==c.apiKey||!Number.isSafeInteger(clock)||timestamp>clock||timestamp+60000<=clock||!same(fields.signature,sha(canonical+c.apiSecret)))fail();
   const bytes=new Uint8Array(await file.arrayBuffer());if(!webp(bytes))fail();
   // Snapshot signed fields/file before any awaiting transport callback.
   const body=new FormData();for(const key of ['overwrite','public_id','timestamp','type','api_key','signature'])body.set(key,fields[key]);body.set('file',new Blob([bytes],{type:'image/webp'}),'processed.webp');
   const response=await request(r.url,{method:'POST',body,headers:{Accept:'application/json','Accept-Encoding':'identity'}},JSON_MAX,context);
   if(response.status!==200)fail();const value=json(response),normalized=Object.fromEntries(uploadKeys.map(k=>[k,value[k]]));if(uploadKeys.some(k=>value[k]===undefined))fail();
   return {status:200,body:JSON.stringify(normalized)};
  },
  async destroy(input,context){
   const r=copyRecord(input,['assetId','publicId','resourceType','deliveryType','invalidate']);
   if(!active||!r||!safeId(r.assetId)||!publicId(r.publicId)||r.resourceType!=='image'||r.deliveryType!=='authenticated'||r.invalidate!==true||!safeId(context?.actorUid))fail();
   await authorized('delete',r,context);const c=await credentials();
   const before=await request(`${API}/resources/${encodeURIComponent(r.assetId)}`,{method:'GET',headers:basic(c)},JSON_MAX,context);
   if(before.status===404){await authorized('delete',r,context);return {result:'not found'};}
   if(before.status!==200)fail();const value=json(before);metadata(value,{assetId:r.assetId,publicId:r.publicId,version:value.version});
   // Caller must revalidate the durable unreferenced delete lease here. Never
   // use public ID deletion, broad prefixes, all=true, or an automatic retry.
   await authorized('delete',r,context);
   const query=new URLSearchParams({'asset_ids[]':r.assetId,invalidate:'true'});
   const response=await request(`${API}/resources?${query}`,{method:'DELETE',headers:basic(c)},JSON_MAX,context);
   if(response.status!==200)fail();const result=json(response);
   if(result.partial===true||result.next_cursor||!result.deleted||Object.keys(result.deleted).length!==1||!['deleted','not_found'].includes(result.deleted[r.assetId]))fail();
   const after=await request(`${API}/resources/${encodeURIComponent(r.assetId)}`,{method:'GET',headers:basic(c)},JSON_MAX,context);
   if(after.status!==404)fail();return {result:'ok'};
  },
  async inspectAsset(input,context){const {bytes,...proof}=await inspect(input,context);return proof;},
  async readApprovedDerivative(input,context){
   const r=copyRecord(input,['derivativeId','version','maxBytes']);if(!active||!r||!safeId(r.derivativeId)||!positive(r.version)||r.maxBytes!==MAX||typeof resolveDerivative!=='function')fail();
   const target=copyRecord(await resolveDerivative({derivativeId:r.derivativeId,version:r.version},context),['assetId','publicId','version','digest']);
   if(!target||target.version!==r.version||!same(target.digest,target.digest))fail();
   const {digest:expected,...scope}=target;await authorized('deliver',scope,context);const result=await inspect(scope,context);
   if(!same(result.digest,expected))fail();await authorized('deliver',scope,context);
   const fresh=await resolveDerivative({derivativeId:r.derivativeId,version:r.version},context);if(!fresh||fresh.assetId!==target.assetId||fresh.publicId!==target.publicId||fresh.version!==target.version||fresh.digest!==target.digest)fail();
   return {derivativeId:r.derivativeId,version:r.version,contentType:'image/webp',bytes:result.bytes};
  }
 });
}
