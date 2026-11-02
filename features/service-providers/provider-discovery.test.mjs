import test from 'node:test';import assert from 'node:assert/strict';
import {createPublicProviderRepository,planPublicProviderQuery,DISCOVERY_FIELDS} from './provider-discovery.mjs';
const catalog={services:['Plumber','Carpenter'],localities:[{city:'Sample City',serviceArea:'Sample North'},{city:'Sample City',serviceArea:'Sample South'}]};
const request={category:'',locality:'',limit:2,cursor:null};
const row=id=>({id,displayName:'Sample '+id,city:'Sample City',serviceArea:'Sample North',services:['Plumber'],available:true,experienceYears:2,description:'Sample only',languages:['en'],published:true,publicationEpoch:1});
function fixture(){let generation=1,calls=0;let data=['p1','p2','p3','p4','p5'].map(row);const cursors=new Map();let counter=0;const deps={enabled:true,catalog,getPublicationEpoch:()=>generation,
 readCursor:t=>cursors.get(t),issueCursor:c=>{const key='cursor_'+(++counter);cursors.set(key,{...c});return key;},query:plan=>{calls++;assert.deepEqual(plan.fields,DISCOVERY_FIELDS);assert.deepEqual(plan.orderBy,['id','asc']);assert.ok(plan.limit<=25);return {publicationEpoch:generation,rows:data.filter(p=>(!plan.after||p.id>plan.after)&&plan.where.every(([field,op,value])=>op==='array-contains'?p[field].includes(value):p[field]===value)).slice(0,plan.limit)};}};
 return {deps,get calls(){return calls;},set data(v){data=v;},bump(){generation++;data=data.map(r=>({...r,publicationEpoch:generation}));}};
}
test('planner fixes public field selection/order, validates bounded category/locality and defaults repository off',async()=>{
 const f=fixture();assert.equal((await createPublicProviderRepository({...f.deps,enabled:false}).discover(request)).ok,false);assert.equal(f.calls,0);
 const plan=planPublicProviderQuery({...request,category:'Plumber',locality:'Sample North'},catalog,{publicationEpoch:1});assert.equal(plan.limit,3);assert.equal(plan.fields.some(f=>/email|phone|owner|admin/.test(f)),false);
 const repo=createPublicProviderRepository(f.deps);for(const patch of [{limit:0},{limit:25},{limit:Infinity},{category:'Unknown'},{locality:'<private>'},{cursor:{}},{cursor:'a'.repeat(1025)},{orderBy:'ownerUid'},{privateFields:true}])assert.equal((await repo.discover({...request,...patch})).ok,false);assert.equal(f.calls,0);
 let evaluated=0;const accessor={...request};Object.defineProperty(accessor,'category',{enumerable:true,get(){evaluated++;return '';}});assert.equal((await repo.discover(accessor)).ok,false);assert.equal(evaluated,0);
});
test('guest public pagination is deterministic, bounded and replayable only within unchanged scope/generation',async()=>{
 const f=fixture(),repo=createPublicProviderRepository(f.deps),first=await repo.discover(request);assert.deepEqual(first.items.map(p=>p.id),['p1','p2']);assert.ok(first.nextCursor);assert.equal(Object.hasOwn(first.items[0],'published'),false);assert.ok(Object.isFrozen(first.items[0].services));
 const second=await repo.discover({...request,cursor:first.nextCursor});assert.deepEqual(second.items.map(p=>p.id),['p3','p4']);assert.deepEqual((await repo.discover({...request,cursor:first.nextCursor})).items,second.items);
 const third=await repo.discover({...request,cursor:second.nextCursor});assert.deepEqual(third.items.map(p=>p.id),['p5']);assert.equal(third.nextCursor,null);
 for(const patch of [{category:'Plumber'},{locality:'Sample North'},{limit:1}])assert.equal((await repo.discover({...request,...patch,cursor:first.nextCursor})).ok,false);
 assert.equal((await repo.discover({...request,cursor:'foreign_cursor'})).ok,false);f.bump();assert.equal((await repo.discover({...request,cursor:first.nextCursor})).ok,false);assert.equal((await repo.discover(request)).ok,true);
});
test('private fields, invalid services/locality/publication, duplicates and unbounded responses fail closed',async()=>{
 for(const bad of [{...row('p1'),email:'private@example.invalid'},{...row('p1'),ownerUid:'private'},{...row('p1'),published:false},{...row('p1'),publicationEpoch:0},{...row('p1'),services:['Unknown']},{...row('p1'),city:'Foreign City'},{...row('p1'),displayName:'<img>'}]){
  const f=fixture();f.deps.query=()=>({publicationEpoch:1,rows:[bad]});const result=await createPublicProviderRepository(f.deps).discover(request);assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes('private@'),false);
 }
 const f=fixture();f.data=[row('p1'),row('p1')];assert.equal((await createPublicProviderRepository(f.deps).discover(request)).ok,false);
 const hidden=row('p1');Object.defineProperty(hidden,'privateEmail',{value:'private'});const hiddenFixture=fixture();hiddenFixture.deps.query=()=>({publicationEpoch:1,rows:[hidden]});assert.equal((await createPublicProviderRepository(hiddenFixture.deps).discover(request)).ok,false);
 const other=fixture();other.deps.query=()=>({publicationEpoch:1,rows:Array(26).fill(row('p1'))});assert.equal((await createPublicProviderRepository(other.deps).discover(request)).ok,false);
 const mismatched=fixture();mismatched.deps.query=()=>({publicationEpoch:1,rows:[{...row('p1'),services:['Carpenter']}]});assert.equal((await createPublicProviderRepository(mismatched.deps).discover({...request,category:'Plumber'})).ok,false);
});
test('publication withdrawal during query or cursor issuance and aborted dependencies return no data',async()=>{
 const f=fixture();f.deps.query=()=>{f.bump();return {publicationEpoch:1,rows:[row('p1')]};};assert.equal((await createPublicProviderRepository(f.deps).discover(request)).ok,false);
 const g=fixture(),issue=g.deps.issueCursor;g.deps.issueCursor=c=>{g.bump();return issue(c);};assert.equal((await createPublicProviderRepository(g.deps).discover(request)).ok,false);
 const h=fixture(),abort=new AbortController();h.deps.query=()=>{abort.abort();return {publicationEpoch:1,rows:[row('p1')]};};assert.equal((await createPublicProviderRepository(h.deps).discover(request,{signal:abort.signal})).ok,false);
 const failed=fixture();failed.deps.query=()=>{throw new Error('private backend token');};const result=await createPublicProviderRepository(failed.deps).discover(request);assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes('token'),false);
});

test('sample publication generation never reuses withdrawn cursors after republishing',async()=>{
 const {createSampleDiscoveryRepository}=await import('./preview-discovery-repository.mjs');let withdrawn=false;const repo=createSampleDiscoveryRepository({withdrawn:()=>withdrawn});const first=await repo.discover(request);assert.equal(first.ok,true);withdrawn=true;assert.equal((await repo.discover({...request,cursor:first.nextCursor})).ok,false);withdrawn=false;assert.equal((await repo.discover({...request,cursor:first.nextCursor})).ok,false);const fresh=await repo.discover(request);assert.equal(fresh.ok,true);assert.ok(fresh.publicationEpoch>first.publicationEpoch);
});
