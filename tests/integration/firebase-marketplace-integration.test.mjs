import test from 'node:test';import assert from 'node:assert/strict';
import {createFirebaseMarketplaceIntegration} from '../../features/marketplace/firebase-integration.mjs';
import {createProductIntegration} from '../../features/marketplace/product-integration.mjs';
import {createAdminApiClient} from '../../functions/admin-backend/admin-api-client.mjs';
function fixture(options={}){let listener,session,n=0,calls=[];const user={uid:'owner',getIdToken:async()=> 'fixture.token.only'},auth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged:fn=>{listener=fn;return ()=>{};}};const bridge=createFirebaseMarketplaceIntegration({enabled:true,auth,makeSessionId:()=> 'session-'+(++n),onSession:s=>session=s,sendCommand:async(op,body,ctx)=>{calls.push({op,body,ctx});return {status:200,body:{ok:true,status:'saved',id:'p',revision:1,generation:1}};},...options});listener?.(user);return {bridge,auth,user,calls,session:()=>session,notify:u=>listener(u)};}
const profile={title:'મૂળ हिन्दी',description:'Sample',category:'cars',locationLabel:'Sample',basePrice:1,isSold:false,storeId:null,photos:[]};
test('existing Product controller saves through scoped token transport; Store kind and Provider ports retained',async()=>{const f=fixture(),model=createProductIntegration({enabled:true,ports:f.bridge.product,makeRequestId:()=> 'request'});model.setSession(f.session());await model.save(profile);assert.equal(model.snapshot().command.status,'saved');assert.equal(f.calls[0].ctx.credential,'fixture.token.only');assert.equal(f.calls[0].body.kind,'product');assert.equal('uid' in f.calls[0].body,false);await f.bridge.store.save({id:null,expectedRevision:0,publication:'draft',profile:{},requestId:'store'}, {session:f.session()});assert.equal(f.calls[1].body.kind,'store');assert.equal((await f.bridge.provider.commands.execute('draft.save',{}, {session:f.session()})).status,503);f.bridge.destroy();});
test('same UID replacement rotates scope and rejects pending tokens without dispatch',async()=>{const f=fixture();let release;f.user.getIdToken=()=>new Promise(r=>release=r);const old=f.session(),task=f.bridge.product.save({id:null,expectedRevision:0,publication:'draft',profile,requestId:'r'},{session:old});const next={uid:'owner',getIdToken:async()=> 'new.token.only'};f.auth.currentUser=next;f.notify(next);release('old.token.only');assert.equal((await task).ok,false);assert.notEqual(f.session().sessionId,old.sessionId);assert.equal(f.calls.length,0);f.bridge.destroy();});
test('logout aborts dispatched mutations with unknown outcome and never retries automatically',async()=>{let signal,resolve;const f=fixture({sendCommand:async(_op,_body,ctx)=>{signal=ctx.signal;return new Promise(r=>resolve=r);}});const task=f.bridge.product.save({id:null,expectedRevision:0,publication:'draft',profile,requestId:'r'},{session:f.session()});while(!resolve)await new Promise(r=>setImmediate(r));f.auth.currentUser=null;f.notify(null);assert.equal(signal.aborted,true);resolve({status:200,body:{ok:true,status:'saved',id:'p',revision:1,generation:1}});assert.equal((await task).code,'OUTCOME_UNKNOWN');f.bridge.destroy();});
test('Admin API uses same scoped token; no browser role or Firestore fallback after logout',async()=>{const f=fixture();let count=0;const api=createAdminApiClient({getIdToken:f.bridge.getAdminIdToken,fetchImpl:async(_url,options)=>{count++;assert.equal(options.headers.Authorization,'Bearer fixture.token.only');return {ok:true,status:200,json:async()=>({ok:true,data:{items:[]}})};}});assert.deepEqual(await api.request('users.list'),{items:[]});f.auth.currentUser=null;f.notify(null);await assert.rejects(api.request('users.list'),{code:'AUTH_REQUIRED'});assert.equal(count,1);f.bridge.destroy();});
test('default-off and production binding never acquire tokens or dispatch public/private transport',async()=>{let calls=0;for(const options of [{},{enabled:true,auth:{app:{options:{projectId:'oldx-1c983'}}}}]){const b=createFirebaseMarketplaceIntegration({...options,sendCommand:()=>calls++,sendRead:()=>calls++});assert.equal((await b.product.list({})).code,'UNAVAILABLE');assert.equal((await b.product.save({})).ok,false);await assert.rejects(b.getAdminIdToken());b.destroy();}assert.equal(calls,0);});
test('public projection rejects private fields and never requests an Auth token',async()=>{let tokens=0;const f=fixture({sendRead:async()=>({status:200,body:{ok:true,profile:{id:'p',kind:'product',revision:1,title:'Original',description:'Public',category:'cars',locationLabel:'Local',basePrice:1,isSold:false,storeId:null,phone:'private'}}})});f.user.getIdToken=async()=>{tokens++;throw Error('Public read must not acquire credentials');};assert.equal((await f.bridge.product.detail({kind:'product',id:'p'})).code,'UNAVAILABLE');assert.equal(tokens,0);f.bridge.destroy();});
test('normal token refresh preserves scope; same UID replacement before observer delivery cannot dispatch',async()=>{const f=fixture(),initial=f.session();f.notify(f.user);assert.deepEqual(f.session(),initial);let release;f.user.getIdToken=()=>new Promise(r=>release=r);const task=f.bridge.product.save({id:null,expectedRevision:0,publication:'draft',profile,requestId:'r'},{session:initial});f.auth.currentUser={uid:'owner',getIdToken:async()=> 'replacement.token.only'};release('old.token.only');assert.equal((await task).ok,false);assert.equal(f.calls.length,0);f.bridge.destroy();});

test('Product Chat requires the current scoped session and preserves the request on explicit retry',async()=>{
 const requests=[];
 const f=fixture({sendProductConversation:async(operation,body,{credential})=>{
  requests.push({operation,body,credential});
  if(operation==='thread')return {status:403,body:{ok:false,error:{code:'DENIED'}}};
  if(requests.length===2)throw Error('Response lost');
  return {status:200,body:{ok:true,status:'replayed'}};
 }});
 const chat=f.bridge.product,context={session:f.session()},body={threadId:'private',requestId:'send-1',expectedRevision:1,text:'ગુજરાતી हिन्दी English'};
 assert.deepEqual(await chat.thread({threadId:'private'}),{ok:false,code:'AUTH_REQUIRED'});
 assert.equal(requests.length,0);
 assert.deepEqual(await chat.thread({threadId:'private'},context),{ok:false,code:'DENIED'});
 assert.deepEqual(await chat.send(body,context),{ok:false,code:'OUTCOME_UNKNOWN'});
 assert.deepEqual(await chat.send(body,context),{ok:true,status:'replayed'});
 assert.deepEqual(requests.slice(1),[1,2].map(()=>({operation:'send',body,credential:'fixture.token.only'})));
 f.bridge.destroy();
});

test('Product Chat aborts a pending private read and discards its reply on account switch',async()=>{
 let release,signal;
 const f=fixture({sendProductConversation:async(_operation,_body,context)=>{
  signal=context.signal;
  return new Promise(resolve=>release=resolve);
 }});
 const old={session:f.session()};
 const task=f.bridge.product.read({threadId:'private'},old);
 while(!release)await new Promise(resolve=>setImmediate(resolve));
 const other={uid:'other',getIdToken:async()=> 'new.token.only'};
 f.auth.currentUser=other;f.notify(other);
 assert.equal(signal.aborted,true);
 release({status:200,body:{ok:true,messages:[{text:'private'}]}});
 assert.deepEqual(await task,{ok:false,code:'AUTH_REQUIRED'});
 assert.deepEqual(await f.bridge.product.read({threadId:'private'},old),{ok:false,code:'AUTH_REQUIRED'});
 f.bridge.destroy();
});
