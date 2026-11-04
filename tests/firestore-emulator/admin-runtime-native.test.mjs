import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';import {getAuth} from 'firebase-admin/auth';
import {initializeApp as webApp,deleteApp as deleteWebApp} from 'firebase/app';
import {getAuth as webAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore as webFirestore,connectFirestoreEmulator,doc,getDoc} from 'firebase/firestore';
import {createEmulatorMarketplaceRuntime,createStagingMarketplaceRuntime} from '../../functions/staging-marketplace/runtime.mjs';
import {STAGING_MARKETPLACE_COLLECTIONS as c} from '../../scripts/staging-marketplace-context.mjs';
let app,client,db,auth,runtime,ownerToken,otherToken,productId,failAtomic=false;
const projectId='demo-oldx-admin-runtime';
const profile={title:'મૂળ हिन्दी',description:'Synthetic',category:'cars',locationLabel:'Sample',basePrice:100,isSold:false,storeId:null,photos:[]};
const body={kind:'product',requestId:'native-create',id:null,expectedRevision:0,publication:'draft',profile};
const request=(value,token=ownerToken)=>({method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(value)});
const call=(op,value,token)=>runtime.handle('/api/staging/marketplace/'+op,request(value,token));
function options(){return {enabled:true,projectId,deploymentEnvironment:'preview',adminFirestore:db,adminAuth:auth,FieldValue,ratePolicy:{windowMs:60000,actorLimit:100,globalLimit:300},createMediaBindings:b=>({photoPolicy:{check:async()=>false},atomicPhotos:{marketplaceCollections:b.collections,prepare:async(tx,claims)=>({ok:true,commit(){tx.set(b.sdk.doc(b.db,c.audits,'media_'+claims.requestKey),{parentId:claims.next.id,operation:claims.action});if(failAtomic)throw Error('Synthetic rollback');}}),verifyReplay:async(tx,claims)=>{const s=await tx.get(b.sdk.doc(b.db,c.audits,'media_'+claims.requestKey));return s.exists()&&s.data().operation===claims.action;}}})};}
before(async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8088'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9098'||process.env.GCLOUD_PROJECT!==projectId)throw Error('Isolated demo Emulators required');
 app=initializeApp({projectId},'native-runtime');db=getFirestore(app);db.settings({host:'127.0.0.1:8088',ssl:false});auth=getAuth(app);
 client=webApp({projectId,apiKey:'fake-api-key'},'native-web');const a=webAuth(client);connectAuthEmulator(a,'http://127.0.0.1:9098',{disableWarnings:true});connectFirestoreEmulator(webFirestore(client),'127.0.0.1',8088);
 for(const uid of ['owner','other']){
  await auth.createUser({uid,email:uid+'@example.test',password:'Synthetic-Test-Only-123'});
  const user=(await signInWithEmailAndPassword(a,uid+'@example.test','Synthetic-Test-Only-123')).user;
  if(uid==='owner')ownerToken=await user.getIdToken();else otherToken=await user.getIdToken();
  await db.collection(c.actors).doc(uid).set({uid,canWrite:true,canPublish:true,suspended:false});
 }
 await db.collection(c.generations).doc('current').set({value:0});runtime=createEmulatorMarketplaceRuntime(options());
});
after(async()=>{if(db)await db.terminate();if(app)await deleteApp(app);if(client)await deleteWebApp(client);});
test('REAL Admin SDK/Auth Emulator creates, edits and retries owner draft with native timestamps',async()=>{
 const created=await call('save',body);assert.equal(created.status,200);productId=created.body.id;
 const record=(await db.collection(c.privateRecords).doc('product_'+productId).get()).data();assert.equal(record.ownerUid,'owner');assert.equal(typeof record.committedAt.toMillis,'function');
 const retry=await call('save',body);assert.equal(retry.body.status,'replayed');assert.equal(retry.body.id,productId);
 const edit=await call('save',{...body,id:productId,requestId:'native-edit',expectedRevision:1,profile:{...profile,title:'Authored ગુજરાતી update'}});assert.equal(edit.body.revision,2);
});
test('REAL token verification denies guest, other owner and foreign audience without private exposure',async()=>{
 const input={kind:'product',id:productId,requestId:null};assert.equal((await call('owner',input,otherToken)).status,403);assert.equal((await call('owner',input,null)).status,401);
 const parts=ownerToken.split('.'),payload=JSON.parse(Buffer.from(parts[1],'base64url'));payload.aud='oldx-1c983';parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');assert.equal((await call('owner',input,parts.join('.'))).status,401);
});
test('REAL native withdrawal, idempotent replay and transaction rollback keep parent/media audit atomic',async()=>{
 const withdraw={...body,id:productId,requestId:'native-withdraw',expectedRevision:2,publication:'withdraw'};
 assert.equal((await call('save',withdraw)).body.revision,3);assert.equal((await call('save',withdraw)).body.status,'replayed');
 const before=await db.collection(c.audits).get();failAtomic=true;
 try{const failed=await call('save',{...withdraw,requestId:'native-rollback',expectedRevision:3});assert.equal(failed.status,202);}finally{failAtomic=false;}
 assert.equal((await db.collection(c.privateRecords).doc('product_'+productId).get()).data().revision,3);assert.equal((await db.collection(c.audits).get()).size,before.size);
});
test('REAL global/actor atomic rate counters enforce limits across identities',async()=>{
 const clock=Date.now()+120000,limited=createEmulatorMarketplaceRuntime({...options(),now:()=>clock,ratePolicy:{windowMs:60000,actorLimit:1,globalLimit:2}}),input={kind:'product',id:productId,requestId:null};
 assert.equal((await limited.handle('/api/staging/marketplace/owner',request(input))).status,200);
 assert.equal((await limited.handle('/api/staging/marketplace/owner',request(input))).status,429);
 assert.equal((await limited.handle('/api/staging/marketplace/owner',request(input,otherToken))).status,403);
 assert.equal((await limited.handle('/api/staging/marketplace/owner',request(input,otherToken))).status,429);
});
test('REAL client SDK remains denied by deny-all; publication and production binding stay closed',async()=>{
 await signInWithEmailAndPassword(webAuth(client),'owner@example.test','Synthetic-Test-Only-123');await assert.rejects(getDoc(doc(webFirestore(client),c.privateRecords,'product_'+productId)),{code:'permission-denied'});await signOut(webAuth(client));
 assert.equal((await call('save',{...body,id:productId,expectedRevision:3,requestId:'publish',publication:'publish'})).status,503);
 assert.equal((await createStagingMarketplaceRuntime(options()).handle('/api/staging/marketplace/save',request(body))).status,503);
 assert.equal((await createEmulatorMarketplaceRuntime({...options(),projectId:'oldx-1c983'}).handle('/api/staging/marketplace/save',request(body))).status,503);
});
test('REAL Admin revocation check rejects an earlier valid Auth Emulator session',async()=>{
 await new Promise(resolve=>setTimeout(resolve,1100));await auth.revokeRefreshTokens('owner');
 assert.equal((await call('owner',{kind:'product',id:productId,requestId:null})).status,401);
});
