import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCloudinarySignedUpload} from '../../scripts/cloudinary-signed-upload.mjs';
import {createCloudinaryUploadHttp} from '../../scripts/cloudinary-upload-http.mjs';
const credentials={cloudName:'tfizvbzc',apiKey:'123456789',apiSecret:'synthetic-test-secret-only'};
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const input={bytes,publicId:'oldx/quarantine/abcdefghijklmnopqrst',resourceType:'image',deliveryType:'authenticated',overwrite:false};
const actor={actorUid:'owner-1'};
function signer(options={}){return createCloudinarySignedUpload({enabled:true,getCredentials:async()=>credentials,authorizeUpload:async()=>true,now:()=>120000,...options});}
test('server-only SHA256 canonical signature and file-bound envelope',async()=>{
 const port=signer(),r=await port.signForServer(input,actor);assert.equal(r.ok,true);
 assert.equal(r.grant.fields.signature,createHash('sha256').update('overwrite=false&public_id='+input.publicId+'&timestamp=120&type=authenticated'+credentials.apiSecret).digest('hex'));
 assert.equal(await port.verifyForServer(r.grant,input,actor),true);
 for(const change of [{actorUid:'other-owner'},{digest:'0'.repeat(64)},{byteSize:1},{mac:'0'.repeat(64)},{fields:{...r.grant.fields,public_id:'oldx/quarantine/otherabcdefghijklmnop'}},{fields:{...r.grant.fields,signature:'0'.repeat(64)}}])assert.equal(await port.verifyForServer({...r.grant,...change},input,actor),false);
 assert.equal(await port.verifyForServer(r.grant,{...input,bytes:new Uint8Array(Buffer.from('RIFF0000WEBPchanged'))},actor),false);
 assert.equal(await port.verifyForServer(r.grant,input,{actorUid:'other-owner'}),false);
});
test('expiry, future timestamp, revocation and cancellation fail closed',async()=>{
 let allowed=true;const port=signer({authorizeUpload:async()=>allowed}),{grant}=await port.signForServer(input,actor);
 assert.equal(await signer({now:()=>180000}).verifyForServer(grant,input,actor),false);
 assert.equal(await signer({now:()=>119000}).verifyForServer(grant,input,actor),false);
 allowed=false;assert.equal(await port.verifyForServer(grant,input,actor),false);
 assert.equal((await port.signForServer(input,actor)).ok,false);
 const controller=new AbortController();controller.abort();assert.equal((await signer().signForServer(input,{...actor,signal:controller.signal})).ok,false);
});
test('disabled, missing credentials, wrong cloud, unsupported bytes and unsafe paths denied',async()=>{
 for(const port of [createCloudinarySignedUpload(),signer({getCredentials:null}),signer({getCredentials:async()=>({...credentials,cloudName:'foreign'})}),signer({now:()=>NaN})])assert.equal((await port.signForServer(input,actor)).ok,false);
 for(const change of [{bytes:new Uint8Array(3*1024*1024+1)},{bytes:new Uint8Array([1])},{publicId:'../private'},{deliveryType:'upload'},{overwrite:true},{url:'https://example.test'}])assert.equal((await signer().signForServer({...input,...change},actor)).ok,false);
});
const body={requestId:'request-1',kind:'provider',parentId:'provider-1',expectedParentRevision:2,byteSize:100,contentType:'image/webp',count:1};
function http(options={}){return createCloudinaryUploadHttp({enabled:true,verifyFirebaseToken:async(_token,ctx)=>{assert.equal(ctx.checkRevoked,true);return {uid:'owner-1'};},consumeRateLimit:async()=>({allowed:true}),readOwnedParent:async scope=>{assert.equal(scope.actorUid,'owner-1');return {kind:'provider',id:'provider-1',ownerUid:'owner-1',revision:2,suspended:false};},...options});}
const request=(value=body)=>({method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fake.token.value'},body:JSON.stringify(value)});
test('HTTP derives owner from verified Firebase token; never exposes a signature or private data',async()=>{
 const result=await http().handle('authorize',request());assert.equal(result.status,200);assert.deepEqual(result.body,{ok:true,kind:'provider',parentId:'provider-1',revision:2,mode:'server-proxy'});assert.equal(result.headers['Cache-Control'],'private, no-store');
 assert.equal((await createCloudinaryUploadHttp().handle('authorize',request())).status,503);
 assert.equal((await http().handle('authorize',{...request(),headers:{'Content-Type':'application/json'}})).status,401);
 assert.equal((await http().handle('authorize',request({...body,ownerUid:'forged'}))).status,400);
});
test('wrong owner, suspension, stale revision and missing rate enforcement denied',async()=>{
 for(const row of [{kind:'provider',id:'provider-1',ownerUid:'other',revision:2,suspended:false},{kind:'provider',id:'provider-1',ownerUid:'owner-1',revision:2,suspended:true}])assert.equal((await http({readOwnedParent:async()=>row}).handle('authorize',request())).status,403);
 assert.equal((await http().handle('authorize',request({...body,expectedParentRevision:1}))).status,409);
 assert.equal((await http({consumeRateLimit:null}).handle('authorize',request())).status,503);
 assert.equal((await http({consumeRateLimit:async()=>({allowed:false})}).handle('authorize',request())).status,429);
 assert.equal((await http({readOwnedParent:async()=>{throw Error('private credential');}}).handle('authorize',request())).body.error.code,'UNAVAILABLE');
});
test('bounded MIME/size/count/schema validation before parent read',async()=>{
 let reads=0;const port=http({readOwnedParent:async()=>{reads++;return null;}});
 for(const change of [{kind:'__proto__'},{byteSize:2*1024*1024+1},{contentType:'image/svg+xml'},{count:2},{parentId:'../x'},{expectedParentRevision:0}])assert.equal((await port.handle('authorize',request({...body,...change}))).status,400);
 assert.equal(reads,0);
});
