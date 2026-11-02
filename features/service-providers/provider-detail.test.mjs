import test from 'node:test';import assert from 'node:assert/strict';
import {createPublicProviderRepository,createPublicProviderDetailRead} from './provider-discovery.mjs';
const catalog={services:['Plumber','Carpenter'],localities:[{city:'Sample City',serviceArea:'Sample North'}]};
const row=()=>({id:'p1',displayName:'Sample',city:'Sample City',serviceArea:'Sample North',services:['Plumber'],available:true,experienceYears:2,description:'Sample only',languages:['en'],published:true,publicationEpoch:1});
const canonical=()=>({providerId:'p1',services:['Plumber'],published:true,publicationEpoch:1});
const request={providerId:'p1',expectedGeneration:1};
const fixture=()=>({enabled:true,catalog,getPublicationEpoch:()=>1,readCanonical:canonical,query:plan=>{assert.equal(plan.limit,1);assert.deepEqual(plan.where[0],['id','==','p1']);return {publicationEpoch:1,rows:[row()]};}});
test('detail defaults disabled and independently revalidates public identity and canonical services',async()=>{
 const deps=fixture();assert.equal((await createPublicProviderRepository({...deps,enabled:false}).detail(request)).ok,false);const result=await createPublicProviderRepository(deps).detail(request);assert.equal(result.ok,true);assert.equal(result.profile.id,'p1');assert.ok(Object.isFrozen(result.profile.services));assert.equal(Object.hasOwn(result.profile,'publicationEpoch'),false);
 for(const bad of [{providerId:'p2'},{published:false},{publicationEpoch:0},{services:['Carpenter']},{services:['unknown']}])assert.equal((await createPublicProviderRepository({...deps,readCanonical:()=>({...canonical(),...bad})}).detail(request)).ok,false);
});
test('stale links, invalid input, forged response IDs, private fields and invalid relationships fail closed',async()=>{
 const deps=fixture();for(const patch of [{providerId:'../private'},{expectedGeneration:0},{ownerUid:'forged'}])assert.equal((await createPublicProviderRepository(deps).detail({...request,...patch})).ok,false);
 for(const patch of [{id:'p2'},{email:'private'},{published:false},{publicationEpoch:0},{services:['Carpenter']},{city:'Foreign'}])assert.equal((await createPublicProviderRepository({...deps,query:()=>({publicationEpoch:1,rows:[{...row(),...patch}]})}).detail(request)).ok,false);
});
test('withdrawal between public read and final canonical recheck returns no stale detail',async()=>{
 let reads=0;const repo=createPublicProviderRepository({...fixture(),readCanonical:()=>({...canonical(),published:++reads===1})});assert.equal((await repo.detail(request)).ok,false);assert.equal(reads,2);
 let generation=1;const repo2=createPublicProviderRepository({...fixture(),getPublicationEpoch:()=>generation,query:()=>{generation++;return {publicationEpoch:1,rows:[row()]};}});assert.equal((await repo2.detail(request)).ok,false);
});
test('detail lifecycle cancels ignored reads, times out and safely recovers with bounded existing helper',async()=>{
 let resolve,expire,read=()=>new Promise(r=>resolve=r);const states=[];const repository={detail:(...args)=>read(...args)};
 const loader=createPublicProviderDetailRead({repository,onChange:s=>states.push(s),schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});const old=loader.load(request);await Promise.resolve();loader.clear();await old;resolve({ok:true,profile:row()});await Promise.resolve();assert.equal(states.at(-1).status,'idle');
 const pending=loader.load(request);await Promise.resolve();expire();await pending;assert.equal(states.at(-1).code,'READ_TIMEOUT');read=()=>createPublicProviderRepository(fixture()).detail(request);await loader.load(request);assert.equal(states.at(-1).status,'ready');
});

test('global generation advances for another provider without hiding older valid public profiles',async()=>{
 let generation=2;
 const first=row(),second={...row(),id:'p2',displayName:'Second',publicationEpoch:2};
 let publicRows=[first,second];
 const deps={...fixture(),getPublicationEpoch:()=>generation,
  readCanonical:()=>canonical(),
  query:plan=>({publicationEpoch:generation,rows:publicRows.filter(p=>plan.where.every(([field,op,value])=>op==='array-contains'?p[field].includes(value):p[field]===value)).slice(0,plan.limit)})};
 const repo=createPublicProviderRepository(deps);
 const listing=await repo.discover({category:'',locality:'',limit:2,cursor:null});
 assert.equal(listing.ok,true);assert.deepEqual(listing.items.map(p=>p.id),['p1','p2']);
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:null})).ok,true);
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:2})).ok,true);
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:1})).ok,false);
 // A different publication epoch for the requested provider is not authorized by its canonical record.
 publicRows=[{...first,publicationEpoch:2},second];
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:null})).ok,false);
 // A future epoch is never a valid snapshot, even if a query falsely claims the current generation.
 publicRows=[{...first,publicationEpoch:3},second];
 assert.equal((await repo.discover({category:'',locality:'',limit:2,cursor:null})).ok,false);
 // Withdrawal still removes the row and invalidates old generation links.
 generation=3;publicRows=[second];
 assert.equal((await repo.detail({providerId:'p1',expectedGeneration:null})).ok,false);
});
test('generation change during older-row read still fails closed',async()=>{
 let generation=2;
 const deps={...fixture(),getPublicationEpoch:()=>generation,query:()=>{generation=3;return {publicationEpoch:2,rows:[row()]};}};
 assert.equal((await createPublicProviderRepository(deps).detail({providerId:'p1',expectedGeneration:null})).ok,false);
});
