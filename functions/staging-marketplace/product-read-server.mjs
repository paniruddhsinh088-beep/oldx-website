import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseBoundedJson} from '../../scripts/bounded-json.mjs';
import {createEmulatorMarketplaceRuntime} from './runtime.mjs';

const route='/api/staging/marketplace/owner';
const maxBytes=32768;
const responseHeaders={
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff',
 Vary:'Authorization'
};
const failure=(status,code)=>({status,body:{ok:false,error:{code}}});

function readHeaders(raw){
 const headers={};
 for(let i=0;i<raw.length;i+=2){
  const name=raw[i].toLowerCase();
  if(!['authorization','content-type','content-encoding'].includes(name))continue;
  if(Object.hasOwn(headers,name))return null;
  headers[name]=raw[i+1];
 }
 return headers;
}

// Network adapter only. Reuse the runtime for token revocation, owner checks,
// atomic quotas and DTO projection. No write or guest routes are registered.
export function createProductReadServer({enabled=false,runtime}={}){
 return createServer({maxHeaderSize:16384,requestTimeout:10000,headersTimeout:10000,connectionsCheckingInterval:1000},async(req,res)=>{
  const controller=new AbortController();
  res.once('close',()=>controller.abort());
  const send=({status,body})=>{
   if(controller.signal.aborted||res.destroyed)return;
   res.writeHead(status,{...responseHeaders,...(!req.complete?{Connection:'close'}:{})});
   res.end(JSON.stringify(body));
  };
  try{
   if(req.url!==route)return send(failure(404,'NOT_FOUND'));
   if(enabled!==true||typeof runtime?.handle!=='function')return send(failure(503,'ENFORCEMENT_UNAVAILABLE'));
   if(req.method!=='POST')return send(failure(405,'METHOD_NOT_ALLOWED'));
   const headers=readHeaders(req.rawHeaders);
   if(!headers)return send(failure(400,'INVALID_REQUEST'));
   if(Number(req.headers['content-length'])>maxBytes)return send(failure(413,'BODY_TOO_LARGE'));
   const chunks=[];let bytes=0;
   for await(const chunk of req.iterator({destroyOnReturn:false})){
    bytes+=chunk.length;
    if(bytes>maxBytes)return send(failure(413,'BODY_TOO_LARGE'));
    chunks.push(chunk);
   }
   const body=Buffer.concat(chunks,bytes),parsed=parseBoundedJson(body,{maxBytes});
   if(parsed.ok&&parsed.value.kind!=='product')return send(failure(400,'INVALID_REQUEST'));
   return send(await runtime.handle(route,{method:req.method,headers,body},{signal:controller.signal}));
  }catch{return send(failure(503,'ENFORCEMENT_UNAVAILABLE'));}
 });
}

export async function listenProductReadServer(server,{port=process.env.PORT??'8080',host='0.0.0.0'}={}){
 if(!/^\d{1,5}$/.test(String(port))||Number(port)<1||Number(port)>65535)throw Error('Invalid PORT');
 server.listen(Number(port),host);
 await once(server,'listening');
 return server;
}

async function main(env){
 // Operational startup deliberately has no SDK initialization path.
 const projectId='demo-oldx-admin-runtime';
 const emulator=env.OLDX_PRODUCT_READ_EMULATOR==='true'
  &&env.GCLOUD_PROJECT===projectId
  &&env.FIREBASE_AUTH_EMULATOR_HOST==='127.0.0.1:9098'
  &&env.FIRESTORE_EMULATOR_HOST==='127.0.0.1:8088';
 let runtime;
 if(emulator){
  const {initializeApp}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const {getFirestore,FieldValue}=await import('firebase-admin/firestore');
  const app=initializeApp({projectId},'product-read-loopback');
  const adminFirestore=getFirestore(app);
  adminFirestore.settings({host:'127.0.0.1:8088',ssl:false});
  runtime=createEmulatorMarketplaceRuntime({enabled:true,projectId,deploymentEnvironment:'preview',
   adminAuth:getAuth(app),adminFirestore,FieldValue,ratePolicy:{windowMs:60000,actorLimit:100,globalLimit:300}});
 }
 await listenProductReadServer(createProductReadServer({enabled:emulator,runtime}),
  {port:env.PORT??'8080',host:emulator?'127.0.0.1':'0.0.0.0'});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.env).catch(()=>{console.error('Product read server startup failed.');process.exitCode=1;});
}
