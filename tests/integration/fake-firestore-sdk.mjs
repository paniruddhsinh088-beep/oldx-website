// SDK-shaped transaction double only; no Firebase initialization or network.
export const SDK_TEST_SCHEMA=Object.freeze(Object.fromEntries(['actors','owners','identities','drafts','receipts','audits','permissions','publications','publicViews','generations'].map(k=>[k,'testProvider'+k[0].toUpperCase()+k.slice(1)])));
export function fakeFirestoreSdk(){
 let data=new Map(),queue=Promise.resolve();const clone=v=>structuredClone(v);
 const metadata={fromCache:false,hasPendingWrites:false};const snapshot=(path,value)=>({id:path.split('/').at(-1),metadata,exists:()=>value!==undefined,data:()=>clone(value)});
 const fixture={calls:0,commits:0,failCommit:false,failSet:false,db:{app:{options:{projectId:'demo-oldx-sdk-test'}},_getSettings:()=>({host:'127.0.0.1:8084',ssl:false})},seed:(collection,id,value)=>data.set(collection+'/'+id,clone(value)),get:(collection,id)=>clone(data.get(collection+'/'+id)??null),snapshot:()=>clone(data)};
 const matches=(v,c)=>c.type==='or'?c.filters.some(f=>matches(v,f)):c.type==='and'?c.filters.every(f=>matches(v,f)):c.op==='array-contains'?Array.isArray(v[c.field])&&v[c.field].includes(c.value):c.op==='>='?v[c.field]>=c.value:c.op==='<='?v[c.field]<=c.value:c.op==='>'?v[c.field]>c.value:c.op==='<'?v[c.field]<c.value:c.op==='in'?c.value.includes(v[c.field]):v[c.field]===c.value;
 fixture.sdk={and:(...filters)=>({type:'and',filters}),or:(...filters)=>({type:'or',filters}),collection:(_,name)=>({name}),where:(field,op,value)=>({type:'where',field,op,value}),orderBy:(field,direction)=>({type:'order',field,direction}),limit:value=>({type:'limit',value}),startAfter:value=>({type:'after',value}),query:(collection,...constraints)=>({collection,constraints}),getDocFromServer:async ref=>snapshot(ref.path,data.get(ref.path)),getDocsFromServer:async query=>{let rows=[...data.entries()].filter(([path])=>path.startsWith(query.collection.name+'/'));for(const c of query.constraints){if(c.type==='where'||c.type==='or'||c.type==='and')rows=rows.filter(([,v])=>matches(v,c));if(c.type==='order')rows.sort((a,b)=>a[1][c.field]<b[1][c.field]?-1:a[1][c.field]>b[1][c.field]?1:0);if(c.type==='after'){const field=query.constraints.find(c=>c.type==='order')?.field??'id';rows=rows.filter(([,v])=>v[field]>c.value);}if(c.type==='limit')rows=rows.slice(0,c.value);}return {metadata,docs:rows.map(([path,v])=>snapshot(path,v))};},doc:(_,collection,id)=>({path:collection+'/'+id}),serverTimestamp:()=>({_testServerTimestamp:true}),
  runTransaction:async(db,callback,options)=>{
   fixture.calls++;let unlock;const before=queue;queue=new Promise(r=>unlock=r);await before;
   try{if(options.maxAttempts!==3)throw new Error('Unbounded retries');const working=clone(data);let writes=false;
    const raw={get:async ref=>{if(writes)throw new Error('Read after write');return {exists:()=>working.has(ref.path),data:()=>clone(working.get(ref.path))};},set:(ref,value)=>{writes=true;if(fixture.failSet)throw new Error('private SDK failure');working.set(ref.path,clone(value));},delete:ref=>{writes=true;working.delete(ref.path);}};
    const result=await callback(raw);if(fixture.failCommit)throw new Error('private commit failure');if(writes){data=working;fixture.commits++;}return result;
   }finally{unlock();}
  }};
 return fixture;
}
