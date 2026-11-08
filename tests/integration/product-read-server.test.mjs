import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createStagingAdminInitializer,createStagingProductReadServer,createProductReadServer,listenProductReadServer,drainProductReadServer} from '../../functions/staging-marketplace/product-read-server.mjs';

test('owner HTTP boundary is default-off and exposes one bounded read route',async()=>{
 let calls=0;
 const runtime={async handle(){calls++;throw Error('Private dependency failure');}};
 for(const enabled of [false,true]){
  const server=createProductReadServer({enabled,runtime});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
   const origin='http://127.0.0.1:'+server.address().port;
   const health=await fetch(origin+'/healthz');
   assert.equal(health.status,200);
   assert.equal(health.headers.get('cache-control'),'private, no-store');
   assert.deepEqual(await health.json(),{ok:true});
   const head=await fetch(origin+'/healthz',{method:'HEAD'});
   assert.equal(head.status,200);
   assert.equal(await head.text(),'');
   assert.equal((await fetch(origin+'/healthz',{method:'POST'})).status,405);
   const owner=(value)=>fetch(origin+'/api/staging/marketplace/owner',{method:'POST',body:JSON.stringify(value)});
   assert.equal((await fetch(origin+'/api/staging/marketplace/save',{method:'POST'})).status,404);
   if(enabled){
    assert.equal((await fetch(origin+'/api/staging/marketplace/owner')).status,405);
    assert.equal((await owner({kind:'store'})).status,400);
    assert.equal((await owner({kind:'product',oversized:'x'.repeat(32768)})).status,413);
   }
   const reply=await owner({kind:'product',id:'sample',requestId:null});
   assert.equal(reply.status,503);
   assert.equal(reply.headers.get('cache-control'),'private, no-store');
   assert.deepEqual(await reply.json(),{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}});
  }finally{await new Promise(resolve=>server.close(resolve));}
 }
 assert.equal(calls,1);
 const missing=createProductReadServer({enabled:true});
 missing.listen(0,'127.0.0.1');await once(missing,'listening');
 try{
  const origin='http://127.0.0.1:'+missing.address().port;
  assert.equal((await fetch(origin+'/healthz')).status,200);
  const reply=await fetch(origin+'/api/staging/marketplace/owner',{method:'POST',body:'{"kind":"product"}'});
  assert.equal(reply.status,503);
  assert.deepEqual(await reply.json(),{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}});
 }finally{await drainProductReadServer(missing);}
 await assert.rejects(listenProductReadServer(createProductReadServer(),{port:'bad'}),/Invalid PORT/);
});

test('drain stops new connections and lets an in-flight owner request finish',async()=>{
 let entered,release;
 const received=new Promise(resolve=>entered=resolve);
 const runtime={handle(){entered();return new Promise(resolve=>release=resolve);}};
 const server=createProductReadServer({enabled:true,runtime});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 const read=fetch(origin+'/api/staging/marketplace/owner',{method:'POST',body:'{"kind":"product"}'});
 await received;
 const draining=drainProductReadServer(server);
 try{await assert.rejects(fetch(origin));}
 finally{release({status:200,body:{ok:true}});await draining;}
 assert.deepEqual(await (await read).json(),{ok:true});
});

const stagingEnv={
 OLDX_PRODUCT_READ_STAGING_ADC:'true',OLDX_FIREBASE_ENV:'staging',OLDX_FIREBASE_PROJECT_ID:'oldx-staging',
 K_SERVICE:'oldx-owner-read',OLDX_PRODUCT_READ_DATABASE_ID:'(default)',OLDX_PRODUCT_READ_SERVICE_ACCOUNT:'owner-read@oldx-staging.iam.gserviceaccount.com',
 OLDX_RATE_WINDOW_MS:'60000',OLDX_RATE_ACTOR_LIMIT:'10',OLDX_RATE_GLOBAL_LIMIT:'100'
};

async function withStagingServer(env,initializeAdmin,check){
 const {server,dispose}=await createStagingProductReadServer(env,initializeAdmin);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 try{await check(origin);}
 finally{await drainProductReadServer(server);await dispose();}
}

function ownerRead(origin,headers={}){
 return fetch(origin+'/api/staging/marketplace/owner',{method:'POST',
  headers:{'Content-Type':'application/json',...headers},
  body:JSON.stringify({kind:'product',id:'fixture',requestId:null})});
}

async function expectDisabled(origin){
 assert.equal((await fetch(origin+'/healthz')).status,200);
 const reply=await ownerRead(origin);
 assert.equal(reply.status,503);
 assert.deepEqual(await reply.json(),{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}});
}

test('staging ADC bootstrap is default-off and rejects unsafe config before initialization',async()=>{
 const unexpected=()=>{assert.fail('Initializer must not run');};
 await withStagingServer(stagingEnv,undefined,expectDisabled);
 for(const patch of [
  {OLDX_PRODUCT_READ_STAGING_ADC:undefined},{OLDX_FIREBASE_ENV:'production'},
  {OLDX_FIREBASE_PROJECT_ID:'oldx-1c983'},{GOOGLE_CLOUD_PROJECT:'oldx-1c983'},
  {FIRESTORE_EMULATOR_HOST:'127.0.0.1:8088'},{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098'},
  {GOOGLE_APPLICATION_CREDENTIALS:''},{CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE:'example.json'},
  {K_SERVICE:undefined},{OLDX_PRODUCT_READ_SERVICE_ACCOUNT:undefined},
  {OLDX_PRODUCT_READ_SERVICE_ACCOUNT:'owner-read@oldx-1c983.iam.gserviceaccount.com'},
  {OLDX_RATE_ACTOR_LIMIT:'101'},{OLDX_PRODUCT_READ_DATABASE_ID:undefined},
  {OLDX_PRODUCT_READ_DATABASE_ID:'unexpected'},{GCE_METADATA_HOST:'example.test'},
  {FIRESTORE_HOST:'example.test'}
 ]){
  let attempts=0;
  await withStagingServer({...stagingEnv,...patch},()=>{attempts++;unexpected();},expectDisabled);
  assert.equal(attempts,0);
 }
});

test('staging ADC bootstrap keeps Firebase authorization separate and disposes synthetic dependencies',async()=>{
 let verified=0,disposed=0;
 const admin={
  serviceAccount:stagingEnv.OLDX_PRODUCT_READ_SERVICE_ACCOUNT,
  adminAuth:{app:{options:{projectId:'oldx-staging'}},async verifyIdToken(token,checkRevoked){
   verified++;
   assert.equal(token,'invalid.test.token');
   assert.equal(checkRevoked,true);
   throw Error('private verifier detail');
  }},
  adminFirestore:{projectId:'oldx-staging',databaseId:'(default)',collection(){assert.fail('Unauthorized Firestore access');},
   runTransaction(){assert.fail('Unauthorized transaction');}},
  FieldValue:{serverTimestamp(){}},
  async dispose(){disposed++;}
 };
 for(const patch of [{serviceAccount:undefined},{serviceAccount:'different'},{adminFirestore:{projectId:'oldx-1c983'}}]){
  await withStagingServer(stagingEnv,async()=>({...admin,...patch}),expectDisabled);
 }
 await withStagingServer(stagingEnv,async()=>{throw Error('private startup detail');},expectDisabled);
 await withStagingServer(stagingEnv,async options=>{
  assert.deepEqual(options,{projectId:'oldx-staging',databaseId:'(default)',expectedServiceAccount:admin.serviceAccount});
  return admin;
 },async origin=>{
  const guest=await ownerRead(origin,{'X-Serverless-Authorization':'Bearer google.invoker.token'});
  assert.equal(guest.status,401);
  assert.equal(verified,0);
  const invalid=await ownerRead(origin,{Authorization:'Bearer invalid.test.token'});
  assert.equal(invalid.status,401);
  assert.doesNotMatch(await invalid.text(),/private verifier detail/);
  assert.equal(verified,1);
  assert.equal((await fetch(origin+'/api/staging/marketplace/save',{method:'POST'})).status,404);
 });
 assert.equal(disposed,4);
});

test('owner read fails closed when the runtime identity cannot use Firestore',async()=>{
 const projectId='oldx-staging';
 let transactions=0;
 const admin={
  serviceAccount:stagingEnv.OLDX_PRODUCT_READ_SERVICE_ACCOUNT,
  adminAuth:{app:{options:{projectId}},async verifyIdToken(_token,checkRevoked){
   assert.equal(checkRevoked,true);
   const now=Math.floor(Date.now()/1000);
   return {uid:'owner',sub:'owner',aud:projectId,iss:'https://securetoken.google.com/'+projectId,iat:now,exp:now+60};
  }},
  adminFirestore:{projectId,databaseId:'(default)',collection(name){return {doc:id=>({name,id})};},
   async runTransaction(){transactions++;throw Object.assign(Error('Private IAM diagnostic'),{code:7});}},
  FieldValue:{serverTimestamp(){}},async dispose(){}
 };
 await withStagingServer(stagingEnv,async()=>admin,async origin=>{
  const response=await ownerRead(origin,{Authorization:'Bearer valid.fixture.token'});
  assert.equal(transactions,1);
  assert.equal(response.status,503);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await response.json(),{ok:false,error:{code:'UNAVAILABLE'}});
  assert.equal((await fetch(origin+'/healthz')).status,200);
 });
});

test('staging Admin initializer verifies metadata, ADC type, attached identity and database before use',async()=>{
 const expectedServiceAccount=stagingEnv.OLDX_PRODUCT_READ_SERVICE_ACCOUNT;
 const options={projectId:'oldx-staging',databaseId:'(default)',expectedServiceAccount};
 let project='oldx-staging',compute=true,email=expectedServiceAccount,database='(default)',firestoreProject='oldx-staging';
 let sdkLoads=0,initialized=0,closed=0,deleted=0,authCalls=0;
 const credential={isComputeEngineCredential:async()=>compute,getServiceAccountEmail:async()=>email};
 const app={};
 const sdk={
  applicationDefault:()=>credential,
  initializeApp(value,name){assert.deepEqual(value,{projectId:'oldx-staging',credential});assert.equal(name,'product-read-staging');initialized++;return app;},
  deleteApp(value){assert.equal(value,app);deleted++;},
  getFirestore(value){assert.equal(value,app);return {projectId:firestoreProject,databaseId:database,async terminate(){closed++;}};},
  getAuth(value){assert.equal(value,app);authCalls++;return {};},
  FieldValue:{}
 };
 const initialize=createStagingAdminInitializer({readProject:async()=>project,loadSdk:async()=>{sdkLoads++;return sdk;}});
 await assert.rejects(initialize({...options,projectId:'oldx-1c983'}));
 await assert.rejects(initialize({...options,databaseId:'unexpected'}));
 project='oldx-1c983';await assert.rejects(initialize(options));project='oldx-staging';
 assert.equal(sdkLoads,0);
 compute=false;await assert.rejects(initialize(options));compute=true;
 email='different@oldx-staging.iam.gserviceaccount.com';await assert.rejects(initialize(options));email=expectedServiceAccount;
 assert.equal(initialized,0);
 database='unexpected';await assert.rejects(initialize(options));database='(default)';
 firestoreProject='oldx-1c983';await assert.rejects(initialize(options));firestoreProject='oldx-staging';
 assert.equal(authCalls,0);assert.equal(closed,2);assert.equal(deleted,2);
 const result=await initialize(options);
 assert.equal(result.serviceAccount,expectedServiceAccount);
 assert.equal(authCalls,1);
 await result.dispose();
 assert.equal(closed,3);assert.equal(deleted,3);
});
