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
