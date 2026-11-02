// SDK-shaped transaction double only; no Firebase initialization or network.
export const SDK_TEST_SCHEMA=Object.freeze(Object.fromEntries(['actors','owners','identities','drafts','receipts','audits','permissions','publications','publicViews','generations'].map(k=>[k,'testProvider'+k[0].toUpperCase()+k.slice(1)])));
export function fakeFirestoreSdk(){
 let data=new Map(),queue=Promise.resolve();const clone=v=>structuredClone(v);
 const fixture={calls:0,commits:0,failCommit:false,failSet:false,db:{app:{options:{projectId:'demo-oldx-sdk-test'}},_getSettings:()=>({host:'127.0.0.1:8084',ssl:false})},seed:(collection,id,value)=>data.set(collection+'/'+id,clone(value)),get:(collection,id)=>clone(data.get(collection+'/'+id)??null),snapshot:()=>clone(data)};
 fixture.sdk={doc:(_,collection,id)=>({path:collection+'/'+id}),serverTimestamp:()=>({_testServerTimestamp:true}),
  runTransaction:async(db,callback,options)=>{
   fixture.calls++;let unlock;const before=queue;queue=new Promise(r=>unlock=r);await before;
   try{if(options.maxAttempts!==3)throw new Error('Unbounded retries');const working=clone(data);let writes=false;
    const raw={get:async ref=>{if(writes)throw new Error('Read after write');return {exists:()=>working.has(ref.path),data:()=>clone(working.get(ref.path))};},set:(ref,value)=>{writes=true;if(fixture.failSet)throw new Error('private SDK failure');working.set(ref.path,clone(value));},delete:ref=>{writes=true;working.delete(ref.path);}};
    const result=await callback(raw);if(fixture.failCommit)throw new Error('private commit failure');if(writes){data=working;fixture.commits++;}return result;
   }finally{unlock();}
  }};
 return fixture;
}
