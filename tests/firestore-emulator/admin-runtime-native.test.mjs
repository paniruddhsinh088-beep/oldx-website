import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue,Filter} from 'firebase-admin/firestore';import {getAuth} from 'firebase-admin/auth';
import {initializeApp as webApp,deleteApp as deleteWebApp} from 'firebase/app';
import {getAuth as webAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore as webFirestore,connectFirestoreEmulator,doc,getDoc} from 'firebase/firestore';
import {createEmulatorMarketplaceRuntime,createStagingMarketplaceRuntime} from '../../functions/staging-marketplace/runtime.mjs';
import {STAGING_MARKETPLACE_COLLECTIONS as c} from '../../scripts/staging-marketplace-context.mjs';
let app,client,db,auth,runtime,ownerToken,otherToken,foreignToken,productId,failAtomic=false;
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
 for(const uid of ['owner','other','foreign']){
  await auth.createUser({uid,email:uid+'@example.test',password:'Synthetic-Test-Only-123'});
  const user=(await signInWithEmailAndPassword(a,uid+'@example.test','Synthetic-Test-Only-123')).user;
  if(uid==='owner')ownerToken=await user.getIdToken();else if(uid==='other')otherToken=await user.getIdToken();else foreignToken=await user.getIdToken();
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
test('REAL native media quotas, references, independent approval and atomic public withdrawal',async()=>{
 const {createHash}=await import('node:crypto');
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs');
 const {createStagingMarketplaceMedia}=await import('../../scripts/staging-marketplace-media.mjs');
 const {mediaQuotaKeys}=await import('../../scripts/firebase-media-journal.mjs');
 const b=createEmulatorMarketplaceBinding(options()),m=b.mediaCollections,j=b.journalCollections;
 const media=createStagingMarketplaceMedia({enabled:true,binding:b,authenticate:async()=>({uid:(await auth.verifyIdToken(ownerToken,true)).uid})});
 const quota={known:true,bytesReserved:0,imagesReserved:0,maxBytes:3000000,maxImages:6,reservationsUsed:0,maxReservations:10};
 for(const key of mediaQuotaKeys('owner','product',productId,null))await db.collection(j.quotas).doc(key).set(quota);
 const reserve={requestId:'native-reserve',kind:'product',parentId:productId,service:null,expectedParentRevision:3,sourceDigest:'a'.repeat(64),reservedBytes:1024};
 const reserved=await media.journal.reserve(reserve);assert.equal(reserved.ok,true);assert.equal((await media.journal.reserve(reserve)).imageId,reserved.imageId);
 assert.equal((await media.journal.transition('attempt',{requestId:'native-attempt',imageId:reserved.imageId,expectedRevision:0,proof:null})).ok,true);
 assert.equal((await media.journal.transition('confirm-upload',{requestId:'no-proof',imageId:reserved.imageId,expectedRevision:1,proof:null})).ok,false);
 assert.equal((await db.collection(j.assets).doc(reserved.imageId).get()).data().state,'uploading');
 const imageId='native_photo_12345678901234567890',digest='b'.repeat(64),scope=createHash('sha256').update(JSON.stringify(['product',productId,null])).digest('hex');
 // Trusted SYNTHETIC metadata fixture, not a claim of provider upload/scanning.
 await db.collection(m.assets).doc(imageId).set({imageId,kind:'product',parentId:productId,ownerUid:'owner',service:null,parentRevision:3,revision:0,state:'quarantined',references:[],processedDigest:digest,processed:{contentType:'image/webp',byteSize:100,width:10,height:10,metadataStripped:true,contentScanned:true}});
 const refs=await media.references.apply({requestId:'native-reference',kind:'product',parentId:productId,expectedParentRevision:3,expectedPhotoRevision:0,imageIds:[imageId],service:null});assert.equal(refs.ok,true);
 await db.collection(m.generations).doc('current').set({value:0});
 await db.collection(m.permissions).doc('owner').set({uid:'owner',canModerate:false,canRelease:true,suspended:false});
 await db.collection(m.permissions).doc('reviewer').set({uid:'reviewer',canModerate:true,canRelease:false,suspended:false});
 const active=createEmulatorMarketplaceRuntime({...options(),publicationEnabled:true,createMediaBindings:binding=>createStagingMarketplaceMedia({enabled:true,binding})});
 const publish={...body,id:productId,requestId:'native-photo-publish',expectedRevision:3,publication:'publish',profile:{...profile,photos:[{kind:'managed',imageId}]}};
 assert.equal((await active.handle('/api/staging/marketplace/save',request(publish))).body.error.code,'PHOTOS_REQUIRED');
 await db.collection(m.reviews).doc(imageId).set({imageId,ownerUid:'owner',moderatorUid:'reviewer',decision:'approved',assetRevision:1,processedDigest:digest,revision:1});
 const accepted=await active.handle('/api/staging/marketplace/save',request(publish));assert.equal(accepted.status,200);
 assert.equal((await db.collection(m.publications).doc(scope).get()).data().parentRevision,4);
 assert.equal((await media.delivery.publicPhotos({kind:'product',parentId:productId,expectedParentRevision:4,expectedPhotoRevision:1})).ok,true);
 const withdrawn=await active.handle('/api/staging/marketplace/save',request({...publish,requestId:'native-photo-withdraw',expectedRevision:4,publication:'withdraw'}));assert.equal(withdrawn.status,200);
 assert.equal((await db.collection(c.publicViews).doc('product_'+productId).get()).exists,false);
 assert.equal((await media.delivery.publicPhotos({kind:'product',parentId:productId,expectedParentRevision:4,expectedPhotoRevision:1})).ok,false);
});
test('REAL native durable provider receipts reconcile lost acknowledgements, lease deletion and quotas',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs');
 const {exerciseNativeMediaProofs}=await import('../integration/media-provider-runtime-cases.mjs');
 let loseAck=false;
 const wrapped={projectId:db.projectId,_settings:db._settings,collection:name=>db.collection(name),runTransaction:async(work,opts)=>{let accepted=false;const result=await db.runTransaction(tx=>work({get:ref=>tx.get(ref),set:(ref,value)=>{if(value.state==='quarantined')accepted=true;tx.set(ref,value);},delete:ref=>tx.delete(ref)}),opts);if(accepted&&loseAck){loseAck=false;throw Error('Synthetic lost acknowledgement AFTER native commit');}return result;}};
 const binding=createEmulatorMarketplaceBinding({...options(),adminFirestore:wrapped});
 await exerciseNativeMediaProofs({binding,loseJournalAck:()=>loseAck=true,seed:(collection,id,value)=>db.collection(collection).doc(id).set(value),read:async(collection,id)=>(await db.collection(collection).doc(id).get()).data()});
});
test('REAL verified Auth preflight drives native media quotas, attempt receipts and private recovery',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs');
 const {createEmulatorMarketplaceEnforcement}=await import('../../scripts/provider-enforcement-adapters.mjs');
 const {exerciseAuthenticatedMedia}=await import('../integration/authenticated-media-cases.mjs');
 const binding=createEmulatorMarketplaceBinding(options()),enforcement=createEmulatorMarketplaceEnforcement({enabled:true,projectId,adminAuth:auth});
 await exerciseAuthenticatedMedia({binding,verifyFirebaseToken:enforcement.verifyFirebaseToken,ownerToken,otherToken,emulatorTokenSyntax:true,seed:(collection,id,value)=>db.collection(collection).doc(id).set(value),read:async(collection,id)=>(await db.collection(collection).doc(id).get()).data()});
});
test('REAL Product/Store private references and approved public bytes share atomic lifecycle',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs');
 const {exercisePhotoLifecycle}=await import('../integration/photo-lifecycle-cases.mjs');const binding=createEmulatorMarketplaceBinding(options());
 const {createEmulatorMarketplaceEnforcement}=await import('../../scripts/provider-enforcement-adapters.mjs');const enforcement=createEmulatorMarketplaceEnforcement({enabled:true,projectId,adminAuth:auth});
 await exercisePhotoLifecycle({binding,verifyFirebaseToken:enforcement.verifyFirebaseToken,ownerToken,otherToken,emulatorTokenSyntax:true,seed:(collection,id,value)=>db.collection(collection).doc(id).set(value),read:async(collection,id)=>(await db.collection(collection).doc(id).get()).data()});
});
test('REAL native public Browse uses bounded projection/cursors and rejects withdrawn/suspended records',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs');const {exerciseNativePublicReads}=await import('../integration/staging-public-query-cases.mjs');
 await exerciseNativePublicReads({binding:createEmulatorMarketplaceBinding(options()),Filter,seed:(collection,id,value)=>db.collection(collection).doc(id).set(value),read:async(collection,id)=>(await db.collection(collection).doc(id).get()).data()});
});
test('REAL native Provider private create/edit/ownership/replay/revision persistence',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs');const {createEmulatorMarketplaceEnforcement}=await import('../../scripts/provider-enforcement-adapters.mjs');const {exerciseNativeProvider}=await import('../integration/provider-native-cases.mjs');
 const enforcement=createEmulatorMarketplaceEnforcement({enabled:true,projectId,adminAuth:auth});
 await exerciseNativeProvider({binding:createEmulatorMarketplaceBinding(options()),authenticate:(token,context)=>enforcement.verifyFirebaseToken(token,{...context,checkRevoked:true}),ownerToken,otherToken,seed:(c,id,value)=>db.collection(c).doc(id).set(value),rows:async c=>(await db.collection(c).get()).docs.map(d=>d.data())});
});
test('REAL native Provider public discovery/detail validates projection, pagination and suspension',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs'),{exerciseNativeProviderReads}=await import('../integration/provider-native-read-cases.mjs');
 await exerciseNativeProviderReads({binding:createEmulatorMarketplaceBinding(options()),seed:(c,id,value)=>db.collection(c).doc(id).set(value)});
});
test('REAL native Provider media journal, references, album quotas and safe deletion',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs'),{exerciseProviderMedia}=await import('../integration/provider-media-cases.mjs');await exerciseProviderMedia({binding:createEmulatorMarketplaceBinding(options()),seed:(c,id,value)=>db.collection(c).doc(id).set(value),read:async(c,id)=>(await db.collection(c).doc(id).get()).data()});
});
test('REAL native Provider contact, private inbox and two-way conversation host',async()=>{
 const {createEmulatorMarketplaceBinding}=await import('../../scripts/staging-marketplace-context.mjs'),{createEmulatorMarketplaceEnforcement}=await import('../../scripts/provider-enforcement-adapters.mjs'),{exerciseNativeProviderContact}=await import('../integration/provider-native-contact-cases.mjs');
 const enforcement=createEmulatorMarketplaceEnforcement({enabled:true,projectId,adminAuth:auth});
 await exerciseNativeProviderContact({binding:createEmulatorMarketplaceBinding(options()),seed:(c,id,value)=>db.collection(c).doc(id).set(value),verifyFirebaseToken:enforcement.verifyFirebaseToken,ownerToken,buyerToken:otherToken,foreignToken,adminAuth:auth});
});
test('REAL trusted Product and Store commands reject forged flags/private fields without domain mutation',async()=>{
 const before=await db.collection(c.privateRecords).get();const audits=await db.collection(c.audits).get();
 const shop={name:'Store',description:'Original',category:'cars',locationLabel:'Locality',photos:[]};
 for(const kind of ['product','store'])for(const field of ['isFeatured','isShopVerified','userIp','phone','coords','ownerUid']){
  const r=await call('save',{...body,kind,requestId:'forged-'+kind+'-'+field,profile:{...(kind==='product'?profile:shop),[field]:field.startsWith('is')?true:'private'}});assert.equal(r.status,400,kind+':'+field);
 }
 assert.equal((await db.collection(c.privateRecords).get()).size,before.size);assert.equal((await db.collection(c.audits).get()).size,audits.size);
});

test('REAL scoped bridge rejects unsigned Emulator tokens while native runtime preserves owner authorization',async()=>{
 const {createFirebaseMarketplaceIntegration}=await import('../../features/marketplace/firebase-integration.mjs');
 const {createProductIntegration}=await import('../../features/marketplace/product-integration.mjs');
 const a=webAuth(client);await signInWithEmailAndPassword(a,'other@example.test','Synthetic-Test-Only-123');
 // Test-only staging-labelled facade around the real demo Auth instance. The
 // runtime still verifies the REAL demo token; no staging app is initialized.
 const facade={app:{options:{projectId:'oldx-staging'}},get currentUser(){return a.currentUser;},onIdTokenChanged:fn=>a.onIdTokenChanged(fn)};
 let model,scope,dispatches=0;const bridge=createFirebaseMarketplaceIntegration({enabled:true,auth:facade,makeSessionId:()=> 'native-bridge',onSession:s=>{scope=s;model?.setSession(s);},sendCommand:(op,value,ctx)=>{dispatches++;return runtime.handle('/api/staging/marketplace/'+op,request(value,ctx.credential),{signal:ctx.signal});}});
 try{model=createProductIntegration({enabled:true,ports:bridge.product,makeRequestId:()=> 'native-bridge-save'});for(let i=0;!scope&&i<200;i++)await new Promise(r=>setTimeout(r,5));assert.ok(scope,'Auth scope must initialize');model.setSession(scope);assert.equal((await a.currentUser.getIdToken()).split('.')[2],'','Auth Emulator deliberately issues unsigned tokens');await model.save(profile);assert.equal(model.snapshot().command.status,'unavailable');assert.equal(dispatches,0,'Do not relax signed-token syntax for Emulator convenience');const token=await a.currentUser.getIdToken();const saved=await call('save',{...body,requestId:'native-bridge-runtime'},token);assert.equal(saved.status,200);const id=saved.body.id;assert.equal((await call('owner',{kind:'product',id,requestId:null},token)).status,200);assert.equal((await db.collection(c.privateRecords).doc('product_'+id).get()).data().ownerUid,'other');await signOut(a);for(let i=0;scope&&i<200;i++)await new Promise(r=>setTimeout(r,5));assert.equal(scope,null,'Logout scope must clear');await model.loadOwner(id);assert.equal(model.snapshot().command.status,'denied');assert.equal(model.snapshot().owner,null);}
 finally{bridge.destroy();}
});

test('REAL Admin revocation check rejects an earlier valid Auth Emulator session',async()=>{
 await new Promise(resolve=>setTimeout(resolve,1100));await auth.revokeRefreshTokens('owner');
 assert.equal((await call('owner',{kind:'product',id:productId,requestId:null})).status,401);
});
