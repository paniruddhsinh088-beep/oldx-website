import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicProviderRepository} from '../../features/service-providers/provider-discovery.mjs';

// A global generation changes on ANY Provider publication. Rows for other
// Providers must retain their own last-publication epoch, not disappear.
test('independent provider publication and withdrawal preserve older public discovery/detail',async()=>{
 const catalog={services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample North'}]};
 const row=(id,publicationEpoch)=>({id,displayName:'Sample '+id,city:'Sample City',serviceArea:'Sample North',
  services:['Plumber'],available:true,experienceYears:2,description:'Sample only',languages:['en'],published:true,publicationEpoch});
 let generation=3;
 const rows=new Map([['p1',row('p1',1)],['p2',row('p2',2)],['p3',row('p3',3)]]);
 const canonical=new Map([...rows].map(([id,value])=>[id,{providerId:id,services:[...value.services],published:true,publicationEpoch:value.publicationEpoch}]));
 const repo=createPublicProviderRepository({enabled:true,catalog,getPublicationEpoch:()=>generation,
  readCursor:()=>null,issueCursor:()=>null,
  readCanonical:id=>canonical.get(id)??null,
  query:plan=>({publicationEpoch:generation,rows:[...rows.values()]
   .filter(p=>plan.where.every(([field,op,value])=>op==='array-contains'?p[field].includes(value):p[field]===value))
   .sort((a,b)=>a.id.localeCompare(b.id)).filter(p=>!plan.after||p.id>plan.after).slice(0,plan.limit)})});
 const list=()=>repo.discover({category:'',locality:'',limit:3,cursor:null});
 const initial=await list();assert.equal(initial.ok,true);assert.deepEqual(initial.items.map(p=>p.id),['p1','p2','p3']);
 for(const id of rows.keys())assert.equal((await repo.detail({providerId:id,expectedGeneration:null})).ok,true);
 generation=4;rows.set('p2',row('p2',4));canonical.set('p2',{providerId:'p2',services:['Plumber'],published:true,publicationEpoch:4});
 assert.deepEqual((await list()).items.map(p=>p.id),['p1','p2','p3']);
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:3})).ok,false);
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:null})).ok,true);
 generation=5;rows.delete('p3');canonical.set('p3',{providerId:'p3',services:['Plumber'],published:false,publicationEpoch:5});
 assert.deepEqual((await list()).items.map(p=>p.id),['p1','p2']);
 assert.equal((await repo.detail({providerId:'p3',expectedGeneration:null})).ok,false);
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:null})).ok,true);
 rows.set('p3',row('p3',6));
 assert.equal((await list()).ok,false);
});
