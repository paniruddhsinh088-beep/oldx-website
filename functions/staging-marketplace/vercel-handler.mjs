// Web-standard Vercel handler artifact. No root api/ entrypoints are installed.
const routes={marketplace:new Set(['save','owner','archive']),media:new Set(['status','recover','remove','reconcileUpload','reconcileDelete'])};
const response=(status,code)=>Response.json({ok:false,error:{code}},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function createCommandFetchHandler({namespace,operation,options={enabled:false},loadRuntime,bodyTimeoutMs=5000}={}){
 return Object.freeze({async fetch(request){
  // Check configuration BEFORE reading input, loading SDKs or acquiring credentials.
  if(options.enabled!==true||!routes[namespace]?.has(operation)||typeof loadRuntime!=='function')return response(503,'ENFORCEMENT_UNAVAILABLE');
  if(!(request instanceof Request))return response(400,'BAD_REQUEST');
  if(request.method!=='POST')return response(405,'METHOD_NOT_ALLOWED');
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')||!['identity',null].includes(request.headers.get('content-encoding')))return response(415,'UNSUPPORTED_MEDIA_TYPE');
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>32768))return response(413,'BODY_TOO_LARGE');
  const controller=new AbortController(),abort=()=>controller.abort();
  request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const timer=setTimeout(abort,Number.isInteger(bodyTimeoutMs)&&bodyTimeoutMs>0&&bodyTimeoutMs<=5000?bodyTimeoutMs:5000);
  let reader;
  try{
   reader=request.body?.getReader();let size=0;const chunks=[];
   if(reader){
    const cancelled=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});if(controller.signal.aborted)reject(Error('cancelled'));});
    while(true){const {done,value}=await Promise.race([reader.read(),cancelled]);if(done)break;size+=value.byteLength;if(size>32768)return response(413,'BODY_TOO_LARGE');chunks.push(value);}
   }
   if(controller.signal.aborted)return response(408,'CANCELLED');
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   let body;try{body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return response(400,'INVALID_REQUEST');}
   // Keep original JSON bytes: shared bounded parser rejects duplicate keys.
   const startupCancelled=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});if(controller.signal.aborted)reject(Error('cancelled'));});
   const runtime=await Promise.race([loadRuntime(),startupCancelled]);clearTimeout(timer);if(controller.signal.aborted)return response(408,'CANCELLED');
   const result=await runtime.handle(`/api/staging/${namespace}/${operation}`,{method:'POST',headers:Object.fromEntries(request.headers),body},{signal:controller.signal});
   return Response.json(result.body,{status:result.status,headers:result.headers});
  }catch{return response(controller.signal.aborted?408:503,controller.signal.aborted?'CANCELLED':'ENFORCEMENT_UNAVAILABLE');}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);if(reader)void reader.cancel().catch(()=>{});}
 }});
}

export const createMarketplaceFetchHandler=options=>createCommandFetchHandler({...options,namespace:"marketplace"});
export const createMediaCommandFetchHandler=options=>createCommandFetchHandler({...options,namespace:"media"});
