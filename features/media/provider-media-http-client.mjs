const unavailable=()=>({status:503,body:{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}}});
const commands=new Set(['ownerPhotos','references','status','recover','remove']);
// Same-origin staging transport only; no automatic endpoint installation, global
// fetch, token storage, provider credentials or unsigned Cloudinary upload.
export function createProviderMediaHttpTransport({enabled=false,fetch:send,origin,timeoutMs=10000}={}){
 let base;try{base=new URL(origin);if(base.origin!==origin||base.username||base.password||base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))base=null;}catch{}
 async function request(operation,body,auth,multipart=false){
  if(enabled!==true||!base||typeof send!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)return unavailable();
  if(auth?.signal?.aborted||typeof auth?.credential!=='string'||auth.credential.length>8192||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(auth.credential))return {status:401};
  const controller=new AbortController(),abort=()=>controller.abort();auth.signal?.addEventListener('abort',abort,{once:true});let reader;
  const cancelled=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('Cancelled')),{once:true}));cancelled.catch(()=>{});const timer=setTimeout(abort,timeoutMs);
  try{
   const headers={Authorization:'Bearer '+auth.credential};if(!multipart)headers['Content-Type']='application/json';
   const response=await Promise.race([send(new URL('/api/staging/provider-media/'+operation,base).href,{method:'POST',headers,body,signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'}),cancelled]);
   if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||Number(response.headers.get('content-length')??0)>16384)return {status:202};
   reader=response.body?.getReader();let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});if(!reader)return {status:202};
   while(true){const result=await Promise.race([reader.read(),cancelled]);if(result.done)break;size+=result.value.byteLength;if(size>16384)return {status:202};text+=decoder.decode(result.value,{stream:true});}text+=decoder.decode();
   const value=JSON.parse(text);return {status:response.status,body:value};
  }catch{return {status:202,body:{ok:false,error:{code:'OUTCOME_UNKNOWN'}}};}
  finally{clearTimeout(timer);controller.abort();await reader?.cancel().catch(()=>{});auth.signal?.removeEventListener('abort',abort);}
 }
 return Object.freeze({sendCommand(operation,body,auth){if(!commands.has(operation))return Promise.resolve(unavailable());let json;try{json=JSON.stringify(body);}catch{return Promise.resolve(unavailable());}if(new TextEncoder().encode(json).length>16384)return Promise.resolve(unavailable());return request(operation,json,auth);},sendUpload(intent,bytes,auth){
  if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(intent?.contentType))return Promise.resolve({status:400});
  let json;try{json=JSON.stringify(intent);}catch{return Promise.resolve(unavailable());}if(new TextEncoder().encode(json).length>2048)return Promise.resolve({status:400});
  const form=new FormData();form.set('intent',json);form.set('file',new Blob([new Uint8Array(bytes)],{type:intent.contentType}),'image');return request('upload',form,auth,true);
 }});
}
