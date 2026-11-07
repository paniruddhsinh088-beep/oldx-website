import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseBoundedJson} from '../../scripts/bounded-json.mjs';
import {createEmulatorMarketplaceRuntime,createStagingMarketplaceRuntime} from './runtime.mjs';

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
   if(req.url==='/healthz'){
    if(req.method!=='GET'&&req.method!=='HEAD')return send(failure(405,'METHOD_NOT_ALLOWED'));
    return send({status:200,body:{ok:true}});
   }
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

export async function drainProductReadServer(server){
 const timer=setTimeout(()=>server.closeAllConnections(),7000);
 timer.unref();
 try{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
 finally{clearTimeout(timer);}
}

const stagingProject='oldx-staging';
const stagingDatabase='(default)';
const validStagingIdentity=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]@oldx-staging\.iam\.gserviceaccount\.com$/.test(value);
const incompatibleEnvironment=[
 'GOOGLE_APPLICATION_CREDENTIALS','CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE',
 'google_application_credentials','CLOUDSDK_CONFIG','GCE_METADATA_HOST','GCE_METADATA_IP',
 'METADATA_SERVER_DETECTION','GOOGLE_CLOUD_QUOTA_PROJECT','FIRESTORE_HOST',
 'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy',
 'GOOGLE_CLOUD_UNIVERSE_DOMAIN','FIREBASE_CONFIG','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST',
 'FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST',
 'STORAGE_EMULATOR_HOST','PUBSUB_EMULATOR_HOST','OLDX_PRODUCT_READ_EMULATOR'
];

async function readStagingMetadataProject(){
 const response=await fetch('http://169.254.169.254/computeMetadata/v1/project/project-id',{
  headers:{'Metadata-Flavor':'Google'},redirect:'error',signal:AbortSignal.timeout(1500)
 });
 if(!response.ok||response.headers.get('Metadata-Flavor')!=='Google')throw Error('Staging metadata unavailable');
 return (await response.text()).trim();
}

async function loadStagingAdminSdk(){
 const {applicationDefault,initializeApp,deleteApp}=await import('firebase-admin/app');
 const {getAuth}=await import('firebase-admin/auth');
 const {getFirestore,FieldValue}=await import('firebase-admin/firestore');
 return {applicationDefault,initializeApp,deleteApp,getAuth,getFirestore,FieldValue};
}

// SDK and metadata are injectable for tests. The pinned SDK's compute check
// rejects file-backed ADC, including credentials from the well-known local path.
export function createStagingAdminInitializer({
 readProject=readStagingMetadataProject,loadSdk=loadStagingAdminSdk
}={}){
 return async({projectId,databaseId,expectedServiceAccount})=>{
  if(projectId!==stagingProject||databaseId!==stagingDatabase||!validStagingIdentity(expectedServiceAccount)
   ||incompatibleEnvironment.some(key=>Object.hasOwn(process.env,key))
   ||await readProject()!==stagingProject)throw Error('Staging Admin unavailable');
  const sdk=await loadSdk();
  const credential=sdk.applicationDefault();
  if(await credential.isComputeEngineCredential?.()!==true
   ||await credential.getServiceAccountEmail?.()!==expectedServiceAccount)throw Error('Staging Admin unavailable');
  const app=sdk.initializeApp({projectId,credential},'product-read-staging');
  let adminFirestore;
  const dispose=async()=>{try{await adminFirestore?.terminate();}finally{await sdk.deleteApp(app);}};
  try{
   adminFirestore=sdk.getFirestore(app);
   if(adminFirestore.projectId!==projectId||adminFirestore.databaseId!==databaseId)throw Error('Staging database unavailable');
   return {serviceAccount:expectedServiceAccount,adminAuth:sdk.getAuth(app),adminFirestore,FieldValue:sdk.FieldValue,dispose};
  }catch(error){
   try{await dispose();}catch{}
   throw error;
  }
 };
}

export async function createStagingProductReadServer(env={},initializeAdmin){
 const disabled=()=>({server:createProductReadServer(),dispose:async()=>{}});
 if(env.OLDX_PRODUCT_READ_STAGING_ADC!=='true'||typeof initializeAdmin!=='function')return disabled();
 const identity=env.OLDX_PRODUCT_READ_SERVICE_ACCOUNT;
 if(env.OLDX_FIREBASE_ENV!=='staging'||env.OLDX_FIREBASE_PROJECT_ID!==stagingProject
  ||env.OLDX_PRODUCT_READ_DATABASE_ID!==stagingDatabase
  ||[env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT,env.gcloud_project,env.google_cloud_project].some(project=>project!==undefined&&project!==stagingProject)
  ||incompatibleEnvironment.some(key=>Object.hasOwn(env,key))
  ||typeof env.K_SERVICE!=='string'||!/^[a-z][a-z0-9-]{0,62}$/.test(env.K_SERVICE)
  ||!validStagingIdentity(identity))return disabled();
 const values=[env.OLDX_RATE_WINDOW_MS,env.OLDX_RATE_ACTOR_LIMIT,env.OLDX_RATE_GLOBAL_LIMIT];
 if(values.some(value=>typeof value!=='string'||!/^\d{1,7}$/.test(value)||Number(value)<1))return disabled();
 const [windowMs,actorLimit,globalLimit]=values.map(Number);
 if(windowMs<1000||windowMs>600000||actorLimit>globalLimit)return disabled();

 let admin;
 try{
  admin=await initializeAdmin({projectId:stagingProject,databaseId:stagingDatabase,expectedServiceAccount:identity});
  const {serviceAccount,adminAuth,adminFirestore,FieldValue}=admin??{};
  if(serviceAccount!==identity||adminAuth?.app?.options?.projectId!==stagingProject
   ||typeof adminAuth.verifyIdToken!=='function'||adminFirestore?.projectId!==stagingProject
   ||adminFirestore.databaseId!==stagingDatabase||typeof adminFirestore.collection!=='function'||typeof adminFirestore.runTransaction!=='function'
   ||typeof FieldValue?.serverTimestamp!=='function'||typeof admin.dispose!=='function')throw Error('Staging Admin unavailable');
  const runtime=createStagingMarketplaceRuntime({enabled:true,projectId:stagingProject,deploymentEnvironment:'preview',
   adminAuth,adminFirestore,FieldValue,ratePolicy:{windowMs,actorLimit,globalLimit}});
  return {server:createProductReadServer({enabled:true,runtime}),dispose:()=>admin.dispose()};
 }catch{
  try{await admin?.dispose?.();}catch{}
  return disabled();
 }
}

async function main(env){
 const projectId='demo-oldx-admin-runtime';
 const emulator=env.OLDX_PRODUCT_READ_EMULATOR==='true'
  &&env.GCLOUD_PROJECT===projectId
  &&env.FIREBASE_AUTH_EMULATOR_HOST==='127.0.0.1:9098'
  &&env.FIRESTORE_EMULATOR_HOST==='127.0.0.1:8088';
 let runtime,dispose;
 if(emulator){
  const {initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const {getFirestore,FieldValue}=await import('firebase-admin/firestore');
  const app=initializeApp({projectId},'product-read-loopback');
  const adminFirestore=getFirestore(app);
  adminFirestore.settings({host:'127.0.0.1:8088',ssl:false});
  dispose=async()=>{await adminFirestore.terminate();await deleteApp(app);};
  runtime=createEmulatorMarketplaceRuntime({enabled:true,projectId,deploymentEnvironment:'preview',
   adminAuth:getAuth(app),adminFirestore,FieldValue,ratePolicy:{windowMs:60000,actorLimit:100,globalLimit:300}});
 }
 const staging=env.OLDX_PRODUCT_READ_ACTIVATE_STAGING==='true'&&!emulator
  ?await createStagingProductReadServer(env,createStagingAdminInitializer())
  :null;
 const server=staging?.server??createProductReadServer({enabled:emulator,runtime});
 if(staging)dispose=staging.dispose;
 try{await listenProductReadServer(server,{port:env.PORT??'8080',host:emulator?'127.0.0.1':'0.0.0.0'});}
 catch(error){await dispose?.();throw error;}
 let stopping=false;
 async function stop(){
  if(stopping)return;
  stopping=true;
  const deadline=setTimeout(()=>process.exit(1),9000);
  deadline.unref();
  try{await drainProductReadServer(server);await dispose?.();}
  catch{console.error('Product read server shutdown failed.');process.exitCode=1;}
  finally{clearTimeout(deadline);}
 }
 process.on('SIGTERM',stop);
 process.on('SIGINT',stop);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.env).catch(()=>{console.error('Product read server startup failed.');process.exitCode=1;});
}
