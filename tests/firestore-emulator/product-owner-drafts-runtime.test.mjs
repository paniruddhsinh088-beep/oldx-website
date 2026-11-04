import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,where,limit,updateDoc,deleteDoc,serverTimestamp,Timestamp} from 'firebase/firestore';
let env;
const path='stagingProductDrafts_v1';
const draft=(sellerUid='owner')=>({sellerUid,title:'મૂળ हिन्दी Sample',description:'Synthetic draft',category:'mobiles',subCategory:'Mobile Phones',basePrice:100,status:'draft',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const ownerDb=()=>env.authenticatedContext('owner').firestore();
before(async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8086'||[process.env.GCLOUD_PROJECT,process.env.GOOGLE_CLOUD_PROJECT].some(p=>p&&p!=='demo-oldx-product-drafts'))throw Error('Loopback demo Emulator required');
 env=await initializeTestEnvironment({projectId:'demo-oldx-product-drafts',firestore:{rules:await readFile(new URL('./product-owner-drafts.candidate.rules',import.meta.url),'utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{for(const id of ['owner','other'])await setDoc(doc(ctx.firestore(),'stagingProductActors_v1',id),{canWrite:true,suspended:false});});
});
after(async()=>{await env?.cleanup();});
test('authenticated owner can create/get/query only own private drafts',async()=>{
 const db=ownerDb();await assertSucceeds(setDoc(doc(db,path,'own'),draft()));
 const read=await assertSucceeds(getDoc(doc(db,path,'own')));assert.equal(read.data().title,'મૂળ हिन्दी Sample');
 await assertSucceeds(getDocs(query(collection(db,path),where('sellerUid','==','owner'),limit(20))));
 await assertFails(getDocs(query(collection(db,path),limit(20))));
 await assertFails(getDocs(query(collection(db,path),where('sellerUid','==','owner'))));
 await assertFails(getDocs(query(collection(db,path),where('sellerUid','==','owner'),limit(21))));
});
test('guest, other owner and admin-like claims cannot read or mutate another draft',async()=>{
 await setDoc(doc(ownerDb(),path,'private'),draft());
 for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('other').firestore(),env.authenticatedContext('moderator',{admin:true}).firestore()]){
  await assertFails(getDoc(doc(db,path,'private')));await assertFails(setDoc(doc(db,path,'forged'),draft()));
  await assertFails(updateDoc(doc(db,path,'private'),{title:'Changed',revision:2,updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db,path,'private')));
 }
});
test('owner updates and withdrawal require monotonic revision and immutable identity/time',async()=>{
 const db=ownerDb(),ref=doc(db,path,'revisioned');await setDoc(ref,draft());
 await assertSucceeds(updateDoc(ref,{title:'Updated',revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref,{title:'Stale',revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref,{sellerUid:'other',revision:3,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref,{createdAt:Timestamp.fromMillis(0),revision:3,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(ref,{status:'withdrawn',revision:3,updatedAt:serverTimestamp()}));
 await assertFails(deleteDoc(ref));
});
test('malformed, public/privileged and Base64 payloads are rejected',async()=>{
 const db=ownerDb();let n=0;
 for(const patch of [{title:''},{title:'x'.repeat(121)},{basePrice:-1},{basePrice:NaN},{basePrice:Infinity},{description:'x'.repeat(1201)},{revision:0},{status:'published'},{isFeatured:true},{isShopVerified:true},{role:'admin'},{phone:'private'},{userIp:'sample'},{coords:{lat:0,lng:0}},{images:['data:image/jpeg;base64,'+'x'.repeat(1100000)]},{updatedAt:Timestamp.fromMillis(0)}])await assertFails(setDoc(doc(db,path,'bad-'+(++n)),{...draft(),...patch}));
 const missing=draft();delete missing.title;await assertFails(setDoc(doc(db,path,'missing'),missing));
 const ref=doc(db,path,'no-escalation');await setDoc(ref,draft());
 for(const patch of [{status:'published'},{isFeatured:true},{isShopVerified:true},{images:['fake'] }])await assertFails(updateDoc(ref,{...patch,revision:2,updatedAt:serverTimestamp()}));
});
test('all legacy/public collections remain denied even to authenticated owner',async()=>{
 const db=ownerDb();for(const name of ['products','stores','users','chats','adminPermissions','serviceProviderPublic_v1','stagingProductPublic_v1']){
  await assertFails(setDoc(doc(db,name,'not-allowed'),draft()));await assertFails(getDoc(doc(db,name,'not-allowed')));
 }
});

test('trusted eligibility is required and suspension cannot be bypassed by owner/admin claims',async()=>{
 const db=ownerDb();await setDoc(doc(db,path,'suspended'),draft());
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'stagingProductActors_v1','owner'),{canWrite:true,suspended:true}));
 try{
  await assertFails(getDoc(doc(db,path,'suspended')));
  await assertFails(updateDoc(doc(db,path,'suspended'),{title:'Blocked',revision:2,updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db,'stagingProductActors_v1','owner'),{canWrite:true,suspended:false}));
  await assertFails(setDoc(doc(env.authenticatedContext('unapproved',{admin:true}).firestore(),path,'unapproved'),draft('unapproved')));
 }finally{await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'stagingProductActors_v1','owner'),{canWrite:true,suspended:false}));}
});
