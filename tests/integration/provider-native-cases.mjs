import assert from 'node:assert/strict';
import {createStagingFirebaseProviderRepository} from '../../scripts/firebase-provider-repository.mjs';
import {createProviderV1Integration} from '../../scripts/provider-schema-v1.mjs';
// Identical acceptance assertions run with native-shaped doubles AND actual
// Admin/Auth/Firestore Emulators. Never uses a live project or real user data.
export async function exerciseNativeProvider({binding,authenticate,ownerToken,otherToken,seed,rows}){
 const schema=binding.providerCollections;
 for(const uid of ['owner','other'])await seed(schema.actors,uid,{uid,canWrite:true,suspended:false});
 await seed(schema.permissions,'owner',{uid:'owner',canPublish:true,canWithdraw:true,suspended:false});await seed(schema.generations,'current',{value:0});
 const repository=createStagingFirebaseProviderRepository({enabled:true,binding}),catalog={version:1,stateCode:'GJ',services:['Repair','Plumber'],localities:[{city:'Ahmedabad',serviceArea:'Sample area'}]};
 const owner=createProviderV1Integration({enabled:true,repository,catalog,authenticate,randomId:()=> 'opaque-native-profile'});
 const profile={displayName:'મૂળ हिन्दी Native',city:'Ahmedabad',serviceArea:'Sample area',services:['Repair','Plumber'],description:'Synthetic original',available:true,experienceYears:null,languages:['gu','hi','en']},input={requestId:'native-provider-create',expectedRevision:0,profile};
 const created=await owner.saveDraft(input,{credential:ownerToken});assert.equal(created.ok,true,JSON.stringify(created));assert.equal((await owner.saveDraft(input,{credential:ownerToken})).status,'replayed');
 const recovered=await owner.bootstrap({operation:'draft.save',requestId:input.requestId},{credential:ownerToken});assert.equal(recovered.draft.displayName,profile.displayName);assert.deepEqual(recovered.draft.services,profile.services);
 const foreign=await owner.bootstrap({operation:'draft.save',requestId:input.requestId},{credential:otherToken});
 // Bootstrap returns the authenticated actor's empty state, not a foreign lookup.
 assert.equal(foreign.ok,true);assert.equal(foreign.exists,false);assert.equal(foreign.providerId,null);assert.equal(foreign.draft,null);assert.equal(foreign.receipt.status,'unknown');assert.equal(JSON.stringify(foreign).includes(profile.displayName),false);
 assert.equal((await owner.saveDraft({...input,requestId:'foreign',expectedRevision:1},{credential:otherToken})).ok,false);
 const outcomes=await Promise.all(['one','two'].map(key=>owner.saveDraft({...input,requestId:'native-race-'+key,expectedRevision:1,profile:{...profile,description:key}},{credential:ownerToken})));assert.equal(outcomes.filter(r=>r.ok).length,1);assert.equal(outcomes.filter(r=>r.code==='REVISION_CONFLICT').length,1);
 assert.equal((await owner.bootstrap({operation:null,requestId:null},{credential:ownerToken})).revision,2);assert.equal((await owner.saveDraft({...input,requestId:'stale',expectedRevision:1},{credential:ownerToken})).code,'REVISION_CONFLICT');
 assert.equal((await owner.managePublication({requestId:'no-media-publish',expectedRevision:2,expectedGeneration:0,action:'publish'},{credential:ownerToken})).ok,false);assert.equal((await rows(schema.publicViews)).length,0);
 await seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:true});assert.equal((await owner.saveDraft({...input,requestId:'suspended',expectedRevision:2},{credential:ownerToken})).code,'DENIED');await seed(schema.actors,'owner',{uid:'owner',canWrite:true,suspended:false});
 assert.equal((await rows(schema.audits)).length,2);assert.equal((await rows(schema.receipts)).length,2);
}
