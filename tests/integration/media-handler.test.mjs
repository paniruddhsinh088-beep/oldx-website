import test from 'node:test';import assert from 'node:assert/strict';
import {createMediaFetchHandler} from '../../functions/staging-marketplace/media-handler.mjs';
import {stagingMediaRouteArtifacts} from '../../functions/staging-marketplace/route-artifacts.mjs';
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const request=(extra=false)=>{const body=new FormData();body.set('intent','{"requestId":"sample"}');body.set('file',new Blob([bytes],{type:'image/webp'}),'../../ignored.webp');if(extra)body.set('ownerUid','forged');return new Request('https://preview.invalid',{method:'POST',headers:{authorization:'Bearer private.test.token'},body});};
test('inactive media handlers/templates never initialize a runtime',async()=>{for(const operation of ['upload','status','remove'])assert.equal((await createMediaFetchHandler({operation}).fetch(request())).status,503);assert.equal(Object.keys(stagingMediaRouteArtifacts()).length,7);});
test('bounded multipart artifact forwards raw intent/file and verified auth boundary only',async()=>{
 let calls=0;const h=createMediaFetchHandler({operation:'upload',options:{enabled:true},loadRuntime:async()=>({upload:async(r,b,context)=>{calls++;assert.equal(r.body,'{"requestId":"sample"}');assert.equal(r.headers.authorization,'Bearer private.test.token');assert.deepEqual(b,bytes);assert.ok(context.signal);return {status:202,headers:{'Cache-Control':'private, no-store'},body:{ok:false,retrySameRequest:true}};}})});
 assert.equal((await h.fetch(request())).status,202);assert.equal(calls,1);assert.equal((await h.fetch(request(true))).status,400);assert.equal(calls,1);
 assert.equal((await h.fetch(new Request('https://preview.invalid',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=test','content-length':'9999999'},body:'x'}))).status,413);
});
test('media JSON commands reuse bounded command handler and forward cancellation',async()=>{
 const h=createMediaFetchHandler({operation:'status',options:{enabled:true},loadRuntime:async()=>({command:async(op,r)=>{assert.equal(op,'status');assert.equal(r.body,'{}');return {status:403,body:{ok:false},headers:{'Cache-Control':'private, no-store'}};}})});
 assert.equal((await h.fetch(new Request('https://preview.invalid',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,403);
});
