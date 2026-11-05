import test from 'node:test';import assert from 'node:assert/strict';
import {createProviderFirebaseSessionPorts} from '../../features/service-providers/firebase-session-ports.mjs';
import {createStagingFirebaseProviderRepository} from '../../scripts/firebase-provider-repository.mjs';
import {createStagingMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';
import {createProviderV1Integration} from '../../scripts/provider-schema-v1.mjs';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {providerJourneyFixture} from './provider-journey-acceptance.mjs';
import {createProviderJourneyIntegration} from '../../features/service-providers/enquiry-integration.mjs';
test('native Provider adapter reuses real transaction core but refuses production, forged binding and publication',async()=>{
 assert.throws(()=>createStagingFirebaseProviderRepository().runTransaction());assert.throws(()=>createStagingFirebaseProviderRepository({enabled:true,binding:{}}));
 const f=fakeFirestoreSdk(),adminFirestore={projectId:'oldx-staging',collection:name=>({doc:id=>f.sdk.doc(f.db,name,id)}),runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,tx=>work({get:async ref=>{const snap=await tx.get(ref);return {exists:snap.exists(),data:snap.data};},set:(...a)=>tx.set(...a),delete:(...a)=>tx.delete(...a)}),opts)};
 assert.throws(()=>createStagingMarketplaceBinding({projectId:'oldx-1c983',deploymentEnvironment:'preview',adminFirestore,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}}));
 const binding=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}}),c=binding.providerCollections;
 f.seed(c.actors,'owner',{uid:'owner',canWrite:true,suspended:false});f.seed(c.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});f.seed(c.generations,'current',{value:0});
 const repo=createStagingFirebaseProviderRepository({enabled:true,binding}),catalog={version:1,stateCode:'GJ',services:['Repair'],localities:[{city:'Ahmedabad',serviceArea:'Sample area'}]},owner=createProviderV1Integration({enabled:true,repository:repo,catalog,authenticate:()=>({uid:'owner'}),randomId:()=> 'opaque-native'});
 const input={requestId:'native',expectedRevision:0,profile:{displayName:'મૂળ हिन्दी',city:'Ahmedabad',serviceArea:'Sample area',services:['Repair'],description:'Original',available:true,experienceYears:null,languages:['gu']}};
 assert.equal((await owner.saveDraft(input)).ok,true);assert.equal((await owner.saveDraft(input)).status,'replayed');assert.equal((await owner.bootstrap({operation:null,requestId:null})).draft.displayName,input.profile.displayName);
 assert.equal((await owner.managePublication({requestId:'publish',expectedRevision:1,expectedGeneration:0,action:'publish'})).ok,false);assert.equal(f.get(c.publicViews,'sp_opaque-native'),null);
});

test('existing Firebase Auth bridge preserves refresh scope and same-key retry through existing HTTP journey',async()=>{
 const f=fakeFirestoreSdk(),fixture=await providerJourneyFixture({sdk:f.sdk,db:f.db,seed:(...a)=>f.seed(...a)});let listener,journey,session,count=0,lost=true;
 const user={uid:'journey-provider',getIdToken:async()=> 'fake.test.token'},auth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged:fn=>{listener=fn;return ()=>{};}};
 const bridge=createProviderFirebaseSessionPorts({enabled:true,auth,makeSessionId:()=> 'session-'+(++count),onSession:value=>{session=value;journey?.setSession(value);},sendCommand:async(op,body,{credential})=>{assert.equal(credential,'fake.test.token');const r=await fixture.execute(op,body);if(lost&&op==='draft.save'){lost=false;throw Error('lost acknowledgement');}return r;}});
 journey=createProviderJourneyIntegration({enabled:true,commands:bridge.commands,owner:bridge.owner,makeRequestId:()=> 'same-key'});listener(user);
 await journey.owner.saveDraft(fixture.profile);assert.equal(journey.owner.snapshot().command.status,'unknown');const original=session.sessionId;listener({...user});assert.equal(session.sessionId,original);assert.equal(count,1);
 await journey.owner.retry();assert.equal(journey.owner.snapshot().command.status,'saved');await journey.owner.bootstrap({restoreDraft:true});assert.equal(journey.owner.snapshot().owner.status,'ready');
 auth.currentUser=null;listener(null);assert.equal(session,null);assert.equal(journey.owner.snapshot().owner.status,'idle');assert.equal((await bridge.commands.execute('draft.save',{}, {session:{uid:user.uid,sessionId:original}})).status,401);bridge.destroy();
});

test('Auth bridge rejects production/defaults, foreign scopes and stale token acquisition',async()=>{
 let listener,resolve,sends=0;const user={uid:'owner',getIdToken:()=>new Promise(r=>resolve=r)},auth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged:fn=>{listener=fn;return ()=>{};}};let session;
 assert.equal((await createProviderFirebaseSessionPorts().commands.execute('draft.save',{})).status,503);
 assert.equal((await createProviderFirebaseSessionPorts({enabled:true,auth:{...auth,app:{options:{projectId:'oldx-1c983'}}},sendCommand:()=>assert.fail()}).commands.execute('draft.save',{})).status,503);
 const bridge=createProviderFirebaseSessionPorts({enabled:true,auth,makeSessionId:()=> 'safe-session',onSession:s=>session=s,sendCommand:()=>{sends++;}});listener(user);
 assert.equal((await bridge.commands.execute('draft.save',{}, {session:{uid:'other',sessionId:'safe-session'}})).status,401);
 const pending=bridge.commands.execute('draft.save',{}, {session});await Promise.resolve();auth.currentUser=null;listener(null);resolve('fake.test.token');assert.equal((await pending).status,401);assert.equal(sends,0);bridge.destroy();
});

test('native Provider authentication composition explicitly requires revoked-token verification',async()=>{
 const {createIsolatedProviderEnforcement}=await import('../../scripts/provider-enforcement-adapters.mjs');const projectId='demo-oldx-provider',seconds=Math.floor(Date.now()/1000);let checked=false;
 const enforcement=createIsolatedProviderEnforcement({enabled:true,projectId,adminAuth:{app:{options:{projectId}},verifyIdToken:async(_token,checkRevoked)=>{checked=checkRevoked;return {uid:'owner',sub:'owner',aud:projectId,iss:'https://securetoken.google.com/'+projectId,iat:seconds,exp:seconds+3600};}}});
 await assert.rejects(enforcement.verifyFirebaseToken('fake.test.token',{}));assert.equal(checked,false);
 const authenticate=(token,context)=>enforcement.verifyFirebaseToken(token,{...context,checkRevoked:true});assert.deepEqual(await authenticate('fake.test.token',{}),{uid:'owner'});assert.equal(checked,true);
});

test('same native Provider acceptance matrix runs locally before real Emulator CI',async()=>{
 const {exerciseNativeProvider}=await import('./provider-native-cases.mjs');const f=fakeFirestoreSdk();
 const adminFirestore={projectId:'oldx-staging',collection:name=>({doc:id=>f.sdk.doc(f.db,name,id)}),runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,tx=>work({get:async ref=>{const snap=await tx.get(ref);return {exists:snap.exists(),data:snap.data};},set:(...a)=>tx.set(...a),delete:(...a)=>tx.delete(...a)}),opts)};
 const binding=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}});
 await exerciseNativeProvider({binding,authenticate:token=>({uid:token}),ownerToken:'owner',otherToken:'other',seed:(...a)=>f.seed(...a),rows:async collection=>[...f.snapshot()].filter(([path])=>path.startsWith(collection+'/')).map(([,value])=>value)});
});
test('media token bridge rejects foreign scopes and logout while token acquisition is pending',async()=>{
 let listener,release,session;const user={uid:'owner',getIdToken:()=>new Promise(r=>release=r)},auth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged:fn=>{listener=fn;return ()=>{};}};
 const bridge=createProviderFirebaseSessionPorts({enabled:true,auth,sendCommand:()=>{},makeSessionId:()=> 'session',onSession:s=>session=s});listener(user);
 await assert.rejects(bridge.getMediaToken({...session,uid:'foreign'}));const task=bridge.getMediaToken(session);auth.currentUser=null;listener(null);release('fixture.token.only');await assert.rejects(task);bridge.destroy();
});
test('native contact host shares durable enquiry and two-way Chat core (SDK double)',async()=>{
 const {exerciseNativeProviderContact}=await import('./provider-native-contact-cases.mjs'),f=fakeFirestoreSdk();
 const adminFirestore={projectId:'oldx-staging',collection:name=>{const parts=[];const q={doc:id=>f.sdk.doc(f.db,name,id),where:(...a)=>{parts.push(f.sdk.where(...a));return q;},orderBy:(...a)=>{parts.push(f.sdk.orderBy(...a));return q;},select:field=>{assert.equal(field,'id');return q;},startAfter:value=>{parts.push(f.sdk.startAfter(value));return q;},limit:value=>{parts.push(f.sdk.limit(value));return q;},get:async()=>f.sdk.getDocsFromServer(f.sdk.query(f.sdk.collection(f.db,name),...parts))};return q;},runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,tx=>work({get:async ref=>{const s=await tx.get(ref);return {exists:s.exists(),data:s.data};},set:(...a)=>tx.set(...a),delete:(...a)=>tx.delete(...a)}),opts)};
 await exerciseNativeProviderContact({binding:createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}}),seed:f.seed,adminAuth:{app:{options:{projectId:'oldx-staging'}},verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);const uid=token==='fixture.owner.token'?'owner':token==='fixture.buyer.token'?'other':'foreign',now=Math.floor(Date.now()/1000);return {uid,sub:uid,aud:'oldx-staging',iss:'https://securetoken.google.com/oldx-staging',iat:now,exp:now+300};}}});
});
test('Provider runtime preflight is diagnostic-only, fail-closed and never reads credentials',async()=>{
 const {inspectStagingProviderConfiguration,PROVIDER_STAGING_SAFE_DEFAULTS}=await import('../../functions/staging-marketplace/provider-media-host.mjs');const result=inspectStagingProviderConfiguration({getCredentials:()=>assert.fail('must not read credentials')});assert.equal(result.ok,false);assert.equal(result.operationallyApproved,false);assert.ok(result.missing.includes('STAGING_BINDING'));assert.equal(result.missing.includes('CLOUDINARY_SERVER_ACCESS'),false);assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(PROVIDER_STAGING_SAFE_DEFAULTS.automaticDeletion,false);assert.equal(PROVIDER_STAGING_SAFE_DEFAULTS.workImages,6);
});
