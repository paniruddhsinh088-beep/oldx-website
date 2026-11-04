import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,collection,getDocs,query,limit} from 'firebase/firestore';

// Same exact deny-all policy proposed for the server-mediated staging slice.
// These are synthetic local documents; NEVER run against a Firebase project.
const fixtures=[
 ['products/readiness-product',{sellerUid:'sample-owner',title:'મૂળ हिन्दी Sample',published:true}],
 ['stores/readiness-store',{ownerUid:'sample-owner',name:'Sample Store',published:true}],
 ['serviceProviders/readiness-legacy',{ownerUid:'sample-owner',status:'active'}],
 ['serviceProviderDrafts_v1/readiness-provider',{ownerUid:'sample-owner',revision:1}],
 ['serviceProviderPublic_v1/readiness-provider',{id:'readiness-provider',published:true,publicationEpoch:1}],
 ['users/sample-owner',{displayName:'Synthetic only',role:'user'}],
 ['chats/readiness-chat',{participants:['sample-owner','sample-buyer']}],
 ['chats/readiness-chat/messages/readiness-message',{senderUid:'sample-owner',text:'Synthetic private note'}],
 ['adminPermissions/sample-owner',{canModerate:false}],
 ['adminAudit/readiness-event',{action:'synthetic-only'}]
];
let env;
before(async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||[process.env.GCLOUD_PROJECT,process.env.GOOGLE_CLOUD_PROJECT].some(p=>p&&p!=='demo-oldx-emulator'))throw Error('Loopback demo Emulator required');
 env=await initializeTestEnvironment({projectId:'demo-oldx-emulator',firestore:{rules:await readFile(new URL('./deny-all.rules',import.meta.url),'utf8')}});
 await env.withSecurityRulesDisabled(async context=>{for(const [path,value] of fixtures)await setDoc(doc(context.firestore(),path),value);});
});
after(async()=>{await env?.cleanup();});

for(const role of ['guest','owner','other','admin-claim'])test(`staging server-only policy denies ${role} direct private/public document reads and mutations`,async()=>{
 const db=role==='guest'?env.unauthenticatedContext().firestore():env.authenticatedContext(role==='owner'?'sample-owner':role==='other'?'sample-other':'sample-admin',{admin:role==='admin-claim',role:role==='admin-claim'?'admin':'user'}).firestore();
 for(const [path] of fixtures){
  await assertFails(getDoc(doc(db,path)));
  await assertFails(updateDoc(doc(db,path),{published:true,ownerUid:'sample-other',role:'admin'}));
  await assertFails(deleteDoc(doc(db,path)));
 }
 for(const name of ['products','stores','serviceProviderPublic_v1','users','chats','adminPermissions']){
  await assertFails(getDocs(query(collection(db,name),limit(20))));
  await assertFails(setDoc(doc(db,name,'readiness-injected'),{ownerUid:'sample-owner',published:true,role:'admin'}));
 }
});

test('trusted fixture context can read seeded documents; this bypass is NOT application authorization',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  assert.equal((await getDoc(doc(db,'products/readiness-product'))).data().title,'મૂળ हिन्दी Sample');
  assert.deepEqual((await getDoc(doc(db,'chats/readiness-chat'))).data().participants,['sample-owner','sample-buyer']);
 });
});
