import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createCloudRunMarketplaceListener} from '../../functions/staging-marketplace/cloud-run-http.mjs';

async function withHost(listener, work) {
 const server=createServer(listener);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try {return await work(`http://127.0.0.1:${server.address().port}`);}
 finally {await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}

test('default off denies without invoking any handler',async()=>{
 let calls=0;
 await withHost(createCloudRunMarketplaceListener({handlers:{save:{fetch(){calls++;throw Error('secret');}}}}),async base=>{
  const r=await fetch(base+'/api/staging/marketplace/save',{method:'POST',body:'{}'});
  assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'private, no-store');
  assert.equal(calls,0);assert.doesNotMatch(await r.text(),/secret/);
 });
});

test('enabled adapter only dispatches exact staging POST routes and passes body to existing handler',async()=>{
 let calls=0;
 const listener=createCloudRunMarketplaceListener({enabled:true,handlers:{save:{async fetch(request){
  calls++;assert.equal(request.method,'POST');
  assert.equal(new URL(request.url).pathname,'/api/staging/marketplace/save');
  assert.equal(await request.text(),'ગુજરાતી हिन्दी');
  return Response.json({ok:true},{status:200,headers:{'cache-control':'public, max-age=30'}});
 }}}});
 await withHost(listener,async base=>{
  for(const path of ['/api/staging/marketplace/save?x=1','/api/staging/marketplace/save/','/api/production/marketplace/save']){
   assert.equal((await fetch(base+path,{method:'POST',body:'{}'})).status,404);
  }
  assert.equal((await fetch(base+'/api/staging/marketplace/save')).status,405);
  assert.equal(calls,0);
  const r=await fetch(base+'/api/staging/marketplace/save',{method:'POST',headers:{'content-type':'application/json'},body:'ગુજરાતી हिन्दी'});
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await r.json(),{ok:true});assert.equal(calls,1);
 });
});

test('missing handler and thrown internal details fail closed',async()=>{
 const listener=createCloudRunMarketplaceListener({enabled:true,handlers:{save:{fetch(){throw Error('private credential');}}}});
 await withHost(listener,async base=>{
  const missing=await fetch(base+'/api/staging/marketplace/owner',{method:'POST',body:'{}'});
  assert.equal(missing.status,503);
  const failed=await fetch(base+'/api/staging/marketplace/save',{method:'POST',body:'{}'});
  assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private credential/);
 });
});

test('streaming oversized handler response is stopped before buffering unlimited output',async()=>{
 let emitted=0, cancelled=false;
 const listener=createCloudRunMarketplaceListener({enabled:true,handlers:{save:{fetch(){
  const body=new ReadableStream({pull(controller){
   emitted++; controller.enqueue(new Uint8Array(32768));
  },cancel(){cancelled=true;}});
  return new Response(body,{status:200});
 }}}});
 await withHost(listener,async base=>{
  const r=await fetch(base+'/api/staging/marketplace/save',{method:'POST',body:'{}'});
  assert.equal(r.status,503);assert.ok(emitted >= 3 && emitted <= 5);assert.equal(cancelled,true);
  assert.equal(r.headers.get('cache-control'),'private, no-store');
 });
});
