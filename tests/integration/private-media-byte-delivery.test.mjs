import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMediaDeliveryContract} from '../../scripts/media-delivery-contract.mjs';
import {createPrivateMediaByteDelivery} from '../../scripts/approved-media-byte-delivery.mjs';
import {createCloudinaryHttpTransport} from '../../scripts/cloudinary-http-transport.mjs';
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
const token='synthetic_private_token_12345',scope={kind:'chat',scopeId:'chat-1',imageId:'abcdefghijklmnopqrst',expectedRevision:2};
function fixture(){
 let active=true,blocked=false,revision=2,actor='buyer',claims={...scope,actorUid:'buyer',expiresAt:120001};
 const authenticate=()=>({uid:actor});
 const contract=createMediaDeliveryContract({enabled:true,authenticate,now:()=>120000,verifyPrivateToken:async()=>claims,readPrivateSnapshot:async()=>({...scope,revision,active,blocked,visibility:'private',participants:['buyer','provider']})});
 let reads=0;const reader=async r=>{reads++;return {imageId:r.imageId,scopeId:r.scopeId,revision:r.revision,contentType:'image/webp',bytes};};
 return {authenticate,contract,reader,get reads(){return reads;},withdraw:()=>active=false,block:()=>blocked=true,revise:()=>revision++,switchActor:()=>actor='foreign',expire:()=>claims={...claims,expiresAt:119999}};
}
test('participant token redemption returns private no-store bytes only',async()=>{
 const f=fixture(),gateway=createPrivateMediaByteDelivery({enabled:true,consumeRateLimit:async()=>({allowed:true}),authenticate:f.authenticate,contract:f.contract,readPrivateDerivative:f.reader});
 const r=await gateway.read({token});assert.equal(r.ok,true);assert.deepEqual(r.bytes,bytes);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(f.reads,1);assert.ok(!JSON.stringify(r).includes(token));
});
test('foreign account, expired token, blocked conversation and withdrawn image deny before bytes',async()=>{
 for(const action of ['switchActor','expire','block','withdraw','revise']){const f=fixture();f[action]();const gateway=createPrivateMediaByteDelivery({enabled:true,consumeRateLimit:async()=>({allowed:true}),authenticate:f.authenticate,contract:f.contract,readPrivateDerivative:f.reader});assert.equal((await gateway.read({token})).ok,false);assert.equal(f.reads,0);}
});
test('revocation, account switch and revision changes during provider read discard bytes',async()=>{
 for(const action of ['withdraw','block','revise','switchActor']){const f=fixture();const gateway=createPrivateMediaByteDelivery({enabled:true,consumeRateLimit:async()=>({allowed:true}),authenticate:f.authenticate,contract:f.contract,readPrivateDerivative:async(...args)=>{const r=await f.reader(...args);f[action]();return r;}});assert.equal((await gateway.read({token})).ok,false);assert.equal(f.reads,1);}
});
test('missing private port never uses a public fallback; malformed or mismatched response denies',async()=>{
 const f=fixture();let publicCalls=0;const contract={...f.contract,publicPhotos:async()=>{publicCalls++;assert.fail('public fallback');}};
 assert.equal((await createPrivateMediaByteDelivery({enabled:true,consumeRateLimit:async()=>({allowed:true}),authenticate:f.authenticate,contract}).read({token})).ok,false);assert.equal(publicCalls,0);
 for(const patch of [{scopeId:'foreign'},{imageId:'foreign'},{revision:3},{contentType:'image/svg+xml'},{bytes:new Uint8Array(3*1024*1024+1)},{private:'secret'}]){const gateway=createPrivateMediaByteDelivery({enabled:true,consumeRateLimit:async()=>({allowed:true}),authenticate:f.authenticate,contract,readPrivateDerivative:async(...args)=>({...await f.reader(...args),...patch})});assert.equal((await gateway.read({token})).ok,false);}
 assert.equal((await createPrivateMediaByteDelivery().read({token})).ok,false);
});
test('provider private resolver is separate, actor-scoped and checked again after HTTP bytes',async()=>{
 let privateAllowed=true,publicCalls=0,privateReads=0;const target={assetId:'asset-1',publicId:'oldx/quarantine/abcdefghijklmnopqrst',version:120,digest:createHash('sha256').update(bytes).digest('hex')};
 const options={enabled:true,mode:'isolated-test',now:()=>120000,getCredentials:async()=>({cloudName:'tfizvbzc',apiKey:'123456789',apiSecret:'synthetic-not-real-secret'}),authorizeAsset:async(_r,ctx)=>ctx.actorUid==='buyer'&&privateAllowed,resolveDerivative:async()=>{publicCalls++;assert.fail('public resolver');},resolvePrivateDerivative:async(r,ctx)=>{privateReads++;assert.equal(r.scopeId,'chat-1');return ctx.actorUid==='buyer'&&privateAllowed?target:null;},fetchImpl:async(url)=>url.includes('/resources/')?Response.json({asset_id:target.assetId,public_id:target.publicId,version:120,resource_type:'image',type:'authenticated',format:'webp',bytes:bytes.length,width:10,height:10}):new Response(bytes,{headers:{'content-type':'image/webp'}})};
 const provider=createCloudinaryHttpTransport(options),request={imageId:'abcdefghijklmnopqrst',scopeId:'chat-1',revision:2,maxBytes:3*1024*1024},context={actorUid:'buyer',deadlineAt:125000};
 assert.deepEqual((await provider.readPrivateDerivative(request,context)).bytes,bytes);assert.equal(publicCalls,0);assert.equal(privateReads,2);
 await assert.rejects(provider.readPrivateDerivative(request,{...context,actorUid:'foreign'}));privateAllowed=false;await assert.rejects(provider.readPrivateDerivative(request,context));assert.equal(publicCalls,0);
});

test('private delivery quota denial fails closed before bytes',async()=>{
 const f=fixture(),gateway=createPrivateMediaByteDelivery({enabled:true,authenticate:f.authenticate,contract:f.contract,readPrivateDerivative:f.reader,consumeRateLimit:async()=>({allowed:false})});
 assert.equal((await gateway.read({token})).ok,false);assert.equal(f.reads,0);
});
