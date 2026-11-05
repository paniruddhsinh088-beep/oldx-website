import assert from 'node:assert/strict';
import {createStagingPublicProviderRepository} from '../../scripts/firebase-provider-public-read.mjs';
export async function exerciseNativeProviderReads({binding,seed}){
 const c=binding.providerCollections,catalog={version:1,stateCode:'GJ',services:['Repair','Plumber'],localities:[{city:'Ahmedabad',serviceArea:'Sample area'}]},book=new Map();let sequence=0;
 const row=id=>({id,displayName:'મૂળ हिन्दी '+id,city:'Ahmedabad',serviceArea:'Sample area',services:['Repair','Plumber'],available:true,experienceYears:3,description:'Original public text',languages:['gu','hi','en'],published:true,publicationEpoch:10});
 await seed(c.generations,'current',{value:10});
 for(const id of ['native-read-a','native-read-b']){const ownerUid=id+'_owner';await seed(c.actors,ownerUid,{uid:ownerUid,canWrite:true,suspended:false});await seed(c.owners,ownerUid,{ownerUid,providerId:id,status:'published',revision:1});await seed(c.identities,id,{providerId:id,ownerUid});await seed(c.publications,id,{providerId:id,ownerUid,published:true,services:['Repair','Plumber'],publicationEpoch:10});await seed(c.drafts,id,{ownerUid,privateNote:'never public'});await seed(c.publicViews,id,row(id));}
 const repo=createStagingPublicProviderRepository({enabled:true,binding,catalog,readCursor:key=>book.get(key),issueCursor:value=>{const key='native-provider-cursor-'+(++sequence);book.set(key,value);return key;}}),request={category:'Repair',locality:'Sample area',limit:1,cursor:null};
 const first=await repo.discover(request);assert.equal(first.ok,true,JSON.stringify(first));assert.equal(first.items[0].id,'native-read-a');assert.ok(first.nextCursor);assert.equal(JSON.stringify(first).includes('ownerUid'),false);assert.equal(JSON.stringify(first).includes('privateNote'),false);
 assert.equal((await repo.discover({...request,cursor:first.nextCursor})).items[0].id,'native-read-b');assert.equal((await repo.discover({...request,category:'Plumber',cursor:first.nextCursor})).ok,false);assert.equal((await repo.discover({...request,cursor:'forged'})).ok,false);
 assert.equal((await repo.detail({providerId:'native-read-a',expectedGeneration:10})).ok,true);
 await seed(c.actors,'native-read-a_owner',{uid:'native-read-a_owner',canWrite:true,suspended:true});assert.equal((await repo.detail({providerId:'native-read-a',expectedGeneration:10})).ok,false);assert.equal((await repo.discover(request)).ok,false);
 await seed(c.actors,'native-read-a_owner',{uid:'native-read-a_owner',canWrite:true,suspended:false});assert.equal((await repo.detail({providerId:'native-read-a',expectedGeneration:10})).ok,true);
 await seed(c.publications,'native-read-a',{providerId:'native-read-a',ownerUid:'native-read-a_owner',published:false,services:['Repair','Plumber'],publicationEpoch:10});assert.equal((await repo.detail({providerId:'native-read-a',expectedGeneration:null})).ok,false);
 await seed(c.generations,'current',{value:11});assert.equal((await repo.discover({...request,cursor:first.nextCursor})).ok,false);
}
