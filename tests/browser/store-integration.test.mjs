import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright-core';import {startPreviewServer} from './preview-server.mjs';import {fakeFirestoreSdk} from '../integration/fake-firestore-sdk.mjs';import {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA as m} from '../../scripts/firebase-marketplace-repository.mjs';
let server,browser,origin;const source=await readFile(new URL('../../index.html',import.meta.url),'utf8');before(async()=>{server=await startPreviewServer([]);origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
for(const locale of ['gu','hi','en'])test('existing Store form public catalogue share and withdrawal at '+(locale==='gu'?320:375)+'px '+locale,async()=>{const context=await browser.newContext({viewport:{width:locale==='gu'?320:375,height:850}});try{const remote=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}if(route.request().url()===origin+'/fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});return route.continue();});const page=await context.newPage();await page.goto(origin+'/fixture');const f=fakeFirestoreSdk();let uid='seller',number=0,lost=false;await page.exposeFunction('storeLoseAck',()=>lost=true);f.seed(m.actors,uid,{uid,canWrite:true,canPublish:true,suspended:false});f.seed(m.generations,'current',{value:0});const tokens=new Map();await page.exposeFunction('storePort',async(op,request)=>{const actor=uid,repo=createIsolatedMarketplaceRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:m,authenticate:()=>({uid:actor}),allocateId:()=> 'store-browser-'+(++number),readCursor:t=>tokens.get(t),issueCursor:v=>{const key='cursor-'+tokens.size;tokens.set(key,v);return key;}});const result=await (op==='save'?repo.save('store',request):repo[op](request));if(op==='save'&&lost&&result.ok){lost=false;return {ok:false,code:'OUTCOME_UNKNOWN'};}return result;});
 const start=source.indexOf('<section id="storePage"'),end=source.indexOf('</section>',start)+10;await page.setContent('<style>*{box-sizing:border-box}body{margin:8px}input,textarea,button{font:inherit;max-width:100%;min-height:44px}input,textarea{width:100%}p,button,h2{overflow-wrap:anywhere}[hidden]{display:none!important}</style>'+source.slice(start,end)+source.slice(source.indexOf('<section id="homeStoresSection"'),source.indexOf('</section>',source.indexOf('<section id="homeStoresSection"'))+10));
 const categories=source.slice(source.indexOf('function renderStoreCategoryChoices('),source.indexOf('async function openOwnStorePage('));
 await page.addScriptTag({content:"const olxCategories=[{id:'cars',name:'Cars'},{id:'electronics',name:'Electronics'}];"+categories});
 await page.addStyleTag({url:origin+'/features/marketplace/integration.css'});
 await page.evaluate(async locale=>{const {mountStoreIntegration}=await import('/features/marketplace/store-integration-dom.mjs'),{loadTranslator}=await import('/features/i18n/i18n.mjs'),{applyCatalog}=await import('/features/i18n/dom.mjs');const translator=await loadTranslator(locale);applyCatalog(document,translator);const {createFirebaseMarketplaceIntegration}=await import('/features/marketplace/firebase-integration.mjs');let observer;const user={uid:'seller',getIdToken:async()=> 'fixture.token.only'};window.storeAuth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged:fn=>{observer=fn;return ()=>{};}};window.storeBridge=createFirebaseMarketplaceIntegration({enabled:true,auth:storeAuth,makeSessionId:()=>crypto.randomUUID(),onSession:s=>window.binding?.setSession(s),sendCommand:async(op,body,ctx)=>{if(ctx.credential!=='fixture.token.only')throw Error('Missing credential');const {kind,...input}=body;const r=await storePort(op,op==='owner'?body:input);return r.ok?{status:200,body:r}:r.code==='OUTCOME_UNKNOWN'?{status:202,body:{ok:false}}:{status:403,body:{ok:false,error:{code:r.code}}};}});window.storeSession=value=>{storeAuth.currentUser=value?user:null;observer(storeAuth.currentUser);};window.binding=mountStoreIntegration({root:document,enabled:true,ports:{...storeBridge.store,...Object.fromEntries(['list','detail'].map(k=>[k,r=>storePort(k,r)]))},getCategory:()=> 'cars',readPhotoReferences:async()=>['data:image/jpeg;base64,YQ=='],translate:key=>translator.t(key),share:value=>window.shared=value});storeSession(true);history.replaceState(null,'','#store');await binding.restoreRoute();},locale);
 await page.locator('input[name="storeCategory"][value="cars"]').check();await page.locator('input[name="storeCategory"][value="electronics"]').check();await page.locator('#storeShopName').fill('મૂળ Store Cafe\u0301');await page.locator('#trustedStoreDescription').fill('Seller original ગુજરાતી');await page.locator('#trustedStoreLocality').fill('Ahmedabad');await page.evaluate(()=>storeLoseAck());await page.locator('#saveStoreBtn').click();await page.waitForFunction(()=>binding.model.snapshot().canRetry);await page.locator('#trustedStoreRetry').click();await page.waitForFunction(()=>binding.model.snapshot().owner?.revision===1);await page.locator('#storeShopName').fill('Unsaved replacement');await page.locator('#trustedStoreLoad').click();await page.waitForFunction(()=>document.querySelector('#storeShopName').value==='મૂળ Store Cafe\u0301');assert.equal(await page.locator('input[name=storeCategory]:checked').count(),2);await page.locator('#trustedStoreDescription').fill('Edited authored text');await page.locator('#saveStoreBtn').click();await page.waitForFunction(()=>binding.model.snapshot().owner?.revision===2);await page.locator('#trustedStorePublish').click();await page.waitForFunction(()=>binding.model.snapshot().owner?.revision===3);const id=await page.evaluate(()=>binding.model.snapshot().owner.id);await page.evaluate(()=>binding.discover({category:'electronics'}));assert.equal(await page.locator('#homeStoresGrid button').textContent(),'મૂળ Store Cafe\u0301');await page.evaluate(async id=>binding.open(id),id);assert.equal(await page.locator('#storePublicWrap h2').textContent(),'મૂળ Store Cafe\u0301');await page.locator('#storeShareTopBtn').click();assert.equal(await page.evaluate(()=>shared.relativeUrl),'#store-'+id);assert.equal(await page.evaluate(()=>Object.hasOwn(shared,'ownerUid')),false);await page.evaluate(()=>document.body.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.evaluate(async()=>{history.pushState(null,'','#store');await binding.restoreRoute();});await page.locator('#trustedStoreWithdraw').click();await page.waitForFunction(()=>binding.model.snapshot().owner?.revision===4);await page.evaluate(async id=>binding.open(id),id);assert.equal(await page.locator('#storePublicWrap').textContent(),'');await page.evaluate(()=>storeSession(false));assert.equal(await page.locator('#storeShopName').inputValue(),'');assert.equal(await page.locator('#saveStoreBtn').isDisabled(),true);await page.evaluate(async()=>{history.pushState(null,'','#store');await binding.restoreRoute();});assert.equal(await page.locator('#storeFormWrap').isVisible(),false);assert.deepEqual(remote,[]);
 }finally{await context.close();}});

for(const locale of ['gu','hi','en'])test('Store replacement retains approved photo until publication and recovers one upload '+locale,async()=>{
 const context=await browser.newContext({viewport:{width:locale==='gu'?320:375,height:850}});
 try{
  await context.route('**/store-media-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  const page=await context.newPage();page.setDefaultTimeout(7000);await page.goto(origin+'/store-media-fixture');
  const start=source.indexOf('<section id="storePage"'),end=source.indexOf('</section>',start)+10;
  await page.setContent('<style>*{box-sizing:border-box}body{margin:8px}input,button,img{max-width:100%}[hidden]{display:none!important}</style>'+source.slice(start,end));
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FQAAAABJRU5ErkJggg==';
  await page.evaluate(async({locale,png})=>{
   const {mountStoreIntegration}=await import('/features/marketplace/store-integration-dom.mjs');
   const {createFirebaseMarketplaceIntegration}=await import('/features/marketplace/firebase-integration.mjs');
   const t=await (await import('/features/i18n/i18n.mjs')).loadTranslator(locale);
   const oldId='old_store_123456789012',newId='new_store_123456789012',id='store-photos';
   const bytes=Uint8Array.from(atob(png),x=>x.charCodeAt(0));
   const ref=imageId=>({kind:'managed',imageId}),fields={name:'મૂળ Store',description:'मूल दुकान',category:'cars',locationLabel:'Ahmedabad'};
   let notify,revision=3,publicRevision=3,ownerPhoto=oldId,publicPhoto=oldId,approved=false;
   window.uploads=[];window.savedPhotos=[];
   const auth={app:{options:{projectId:'oldx-staging'}},currentUser:null,onIdTokenChanged(fn){notify=fn;return ()=>{};}};
   window.storeBridge=createFirebaseMarketplaceIntegration({enabled:true,auth,onSession:value=>window.sessionChange=binding.setSession(value),
    sendCommand:async(op,body,{credential})=>{
     if(credential!=='owner.fixture.token')return {status:403,body:{error:{code:'DENIED'}}};
     if(op==='owner')return {status:200,body:{ok:true,id,revision,profile:{...fields,photos:[ref(ownerPhoto)]},published:true,publicationRevision:publicRevision,receipt:null}};
     if(body.publication==='publish'&&!approved)return {status:409,body:{error:{code:'PHOTOS_REQUIRED'}}};
     ownerPhoto=body.profile.photos[0].imageId;savedPhotos.push(ownerPhoto);revision++;
     if(body.publication==='publish'){publicRevision=revision;publicPhoto=ownerPhoto;}
     return {status:200,body:{ok:true,status:'saved',id,revision,generation:1}};
    },
    sendRead:async op=>({status:200,body:op==='detail'?{ok:true,profile:{id,kind:'store',revision:publicRevision,...fields}}:{ok:true,items:[],nextCursor:null}}),
    storeMedia:{
     sendUpload:async(intent,data,{credential})=>{
      if(credential!=='owner.fixture.token'||intent.kind!=='store'||intent.parentId!==id||intent.expectedParentRevision!==3||data.length!==bytes.length)throw Error('Wrong scope');
      uploads.push(intent.requestId);return {status:202};
     },
     sendCommand:async(op,body,{credential})=>{
      if(credential!=='owner.fixture.token')return {status:403};
      if(op==='ownerPhotos')return {status:200,body:{ok:true,parentId:id,parentRevision:revision,photoRevision:1,photos:[ref(ownerPhoto)]}};
      if(body.requestId!==uploads[0])throw Error('Retry changed receipt');
      return {status:200,body:{ok:true,state:'quarantined',parentRevision:3,imageId:newId}};
     },
     readManifest:async({expectedParentRevision})=>expectedParentRevision===publicRevision?{ok:true,parentId:id,parentRevision:publicRevision,photoRevision:publicRevision,photos:[{imageId:publicPhoto,derivativeId:'approved',version:publicRevision}]}:{ok:false},
     readBytes:async request=>request.imageId===publicPhoto&&request.expectedParentRevision===publicRevision?{ok:true,bytes,headers:{'Content-Type':'image/png'}}:{ok:false}
    }});
   window.binding=mountStoreIntegration({enabled:true,ports:storeBridge.store,media:storeBridge.storeMedia,translate:t.t,getCategory:()=> 'cars'});
   window.switchStoreAccount=async uid=>{auth.currentUser=uid?{uid,getIdToken:async()=>uid+'.fixture.token'}:null;notify(auth.currentUser);await sessionChange;};
   window.editStore=async()=>{history.replaceState(null,'','#store');await binding.restoreRoute();};
   window.openStore=()=>binding.open(id);window.approveStore=()=>{approved=true;};
   await switchStoreAccount('owner');await openStore();
  },{locale,png});
  const publicImage=page.locator('#storePublicWrap img[src^="blob:"]');
  await publicImage.waitFor();const oldUrl=await publicImage.getAttribute('src');
  await page.evaluate(()=>editStore());
  const workflow=page.locator('.oldx-photo-workflow');
  await workflow.locator('[data-photo-action=remove]').click();
  await page.locator('#storePhotoFile').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  const upload=workflow.locator('[data-photo-action=upload]');
  await upload.click();await page.waitForFunction(()=>uploads.length===1);await upload.click();
  await page.waitForFunction(()=>document.querySelector('.oldx-photo-workflow [data-photo-action=upload]')?.disabled);
  await page.locator('#saveStoreBtn').click();await page.waitForFunction(()=>binding.model.snapshot().owner?.revision===4);
  await page.evaluate(()=>openStore());await publicImage.waitFor();
  assert.equal(await page.evaluate(()=>binding.model.snapshot().store.revision),3);
  assert.equal(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},oldUrl),true);
  await page.evaluate(async()=>{await editStore();approveStore();});
  await page.locator('#trustedStorePublish').click();await page.waitForFunction(()=>binding.model.snapshot().owner?.revision===5);
  await page.evaluate(()=>openStore());await publicImage.waitFor();
  assert.equal(await page.evaluate(()=>binding.model.snapshot().store.revision),5);
  assert.deepEqual(await page.evaluate(()=>savedPhotos),['new_store_123456789012','new_store_123456789012']);
  assert.equal(await page.evaluate(()=>uploads.length),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.evaluate(async()=>{await editStore();await switchStoreAccount('foreign');});
  assert.equal(await page.locator('#storeShopName').inputValue(),'');
  assert.equal(await workflow.locator('[data-photo-action=remove]').count(),0);
  await page.evaluate(()=>switchStoreAccount(null));
  assert.equal(await page.locator('#saveStoreBtn').isDisabled(),true);
 }finally{await context.close();}
});
