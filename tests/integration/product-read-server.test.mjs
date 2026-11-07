import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createProductReadServer,listenProductReadServer} from '../../functions/staging-marketplace/product-read-server.mjs';

test('owner HTTP boundary is default-off and exposes one bounded read route',async()=>{
 let calls=0;
 const runtime={async handle(){calls++;throw Error('Private dependency failure');}};
 for(const enabled of [false,true]){
  const server=createProductReadServer({enabled,runtime});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
   const origin='http://127.0.0.1:'+server.address().port;
   const owner=(value)=>fetch(origin+'/api/staging/marketplace/owner',{method:'POST',body:JSON.stringify(value)});
   assert.equal((await fetch(origin+'/api/staging/marketplace/save',{method:'POST'})).status,404);
   if(enabled){
    assert.equal((await fetch(origin+'/api/staging/marketplace/owner')).status,405);
    assert.equal((await owner({kind:'store'})).status,400);
    assert.equal((await owner({kind:'product',oversized:'x'.repeat(32768)})).status,413);
   }
   const reply=await owner({kind:'product',id:'sample',requestId:null});
   assert.equal(reply.status,503);
   assert.equal(reply.headers.get('cache-control'),'private, no-store');
   assert.deepEqual(await reply.json(),{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}});
  }finally{await new Promise(resolve=>server.close(resolve));}
 }
 assert.equal(calls,1);
 await assert.rejects(listenProductReadServer(createProductReadServer(),{port:'bad'}),/Invalid PORT/);
});
