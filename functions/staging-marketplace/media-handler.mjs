import {createMediaCommandFetchHandler} from './vercel-handler.mjs';
const fail=(status,code)=>Response.json({ok:false,error:{code}},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
// INACTIVE artifact only. Runtime/verified identity/processing ports must be
// explicitly supplied by an approved server composition. No environment reads.
export function createMediaFetchHandler({operation,options={enabled:false},loadRuntime}={}){
 if(operation!=='upload')return createMediaCommandFetchHandler({operation,options,loadRuntime:async()=>{const runtime=await loadRuntime();return {handle:(_path,request,context)=>runtime.command(operation,request,context)};}});
 return Object.freeze({async fetch(request){
  if(options.enabled!==true||typeof loadRuntime!=='function')return fail(503,'ENFORCEMENT_UNAVAILABLE');
  if(!(request instanceof Request)||request.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
  const type=request.headers.get('content-type')??'',limit=3*1024*1024+32768;
  if(type.length>256||!/^multipart\/form-data;\s*boundary=(?:[A-Za-z0-9'()+_,./:=?-]{1,70}|"[A-Za-z0-9'()+_,./:=?-]{1,70}")$/.test(type)||!['identity',null].includes(request.headers.get('content-encoding')))return fail(415,'UNSUPPORTED_MEDIA_TYPE');
  const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))return fail(413,'BODY_TOO_LARGE');
  const controller=new AbortController(),abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  let reader;const timer=setTimeout(abort,5000);
  const cancelled=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('Cancelled')),{once:true}));
  // Avoid a pending rejection when an already aborted request has no body.
  cancelled.catch(()=>{});
  try{
   if(controller.signal.aborted)return fail(408,'CANCELLED');reader=request.body?.getReader();const chunks=[];let size=0;
   if(reader)while(true){const {done,value}=await Promise.race([reader.read(),cancelled]);if(done)break;size+=value.length;if(size>limit)return fail(413,'BODY_TOO_LARGE');chunks.push(new Uint8Array(value));}
   const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
   const body=await Promise.race([new Response(raw,{headers:{'content-type':type}}).formData(),cancelled]);
   if([...body.keys()].sort().join(',')!=='file,intent')return fail(400,'INVALID_REQUEST');
   const intent=body.get('intent'),file=body.get('file');if(typeof intent!=='string'||new TextEncoder().encode(intent).length>16384||!(file instanceof Blob)||file.size<1||file.size>3*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return fail(400,'INVALID_REQUEST');
   const bytes=new Uint8Array(await file.arrayBuffer()),runtime=await Promise.race([loadRuntime(),cancelled]);if(controller.signal.aborted)return fail(408,'CANCELLED');clearTimeout(timer);
   const result=await runtime.upload({method:'POST',headers:{'content-type':'application/json',authorization:request.headers.get('authorization')??''},body:intent},bytes,{signal:controller.signal});
   return Response.json(result.body,{status:result.status,headers:result.headers});
  }catch{return fail(controller.signal.aborted?408:503,controller.signal.aborted?'CANCELLED':'ENFORCEMENT_UNAVAILABLE');}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);if(reader)void reader.cancel().catch(()=>{});}
 }});
}
