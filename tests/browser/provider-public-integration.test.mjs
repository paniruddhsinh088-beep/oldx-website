import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {startPreviewServer} from './preview-server.mjs';
import {fakeFirestoreSdk} from '../integration/fake-firestore-sdk.mjs';
import {providerJourneyFixture} from '../integration/provider-journey-acceptance.mjs';
let server,browser,origin;
before(async()=>{server=await startPreviewServer(['service-preview.html']);origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
for(const locale of ['gu','hi','en'])test('existing public Provider page discovery/detail/private enquiry/withdrawal '+locale,async()=>{
 const context=await browser.newContext({viewport:{width:locale==='gu'?320:375,height:850}});
 try{
 const remote=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}return route.continue();});
 const fake=fakeFirestoreSdk(),f=await providerJourneyFixture({sdk:fake.sdk,db:fake.db,seed:(...a)=>fake.seed(...a)});
 const authored='સેવાનોવિગતविक्रेताकाविवरणProviderDescription'.repeat(18);
 await f.owner.saveDraft({requestId:'public-draft',expectedRevision:0,profile:{...f.profile,description:authored}});const owned=await f.owner.bootstrap({operation:null,requestId:null});await f.owner.managePublication({requestId:'public-publish',expectedRevision:1,expectedGeneration:0,action:'publish'});f.uid('journey-buyer');
 let releaseDiscovery;
 let holdDiscovery=null;
 const page=await context.newPage();await page.exposeFunction('publicDiscover',async r=>{
  const pending=holdDiscovery;
  if(pending){holdDiscovery=null;await new Promise(resolve=>{releaseDiscovery=resolve;pending();});}
  return f.publicReads.discover(r);
 });await page.exposeFunction('publicDetail',r=>f.publicReads.detail(r));await page.exposeFunction('privateExecute',(op,body)=>f.execute(op,body));
 async function boot(){await page.evaluate(async locale=>{const {configureWebsiteProviderFirebase}=await import('/features/service-providers/service-preview.mjs');window.openedEnquiry=null;const user={uid:'journey-buyer',getIdToken:async()=> 'isolated.test.token'},auth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged:fn=>{queueMicrotask(()=>fn(user));return ()=>{};}};window.binding=configureWebsiteProviderFirebase({enabled:true,auth,sendCommand:(op,body)=>privateExecute(op,body),catalog:{services:['Plumber','Repair'],localities:[{city:'Ahmedabad',serviceArea:'Sample area'}]},reads:{discover:r=>publicDiscover(r),detail:r=>publicDetail(r)},buyer:{commands:{execute:(op,body)=>privateExecute(op,body)}},openPrivateEnquiry:value=>window.openedEnquiry=value});document.querySelector('#localeSelect').value=locale;document.querySelector('#localeSelect').dispatchEvent(new Event('change'));},locale);}
 await page.goto(origin+'/service-preview.html?mode=website#services');await boot();await page.waitForFunction(()=>document.querySelector('#results [data-provider-id]'));
 await page.waitForFunction(code=>document.documentElement.lang===code,locale);
 const translator=await (await import('../../features/i18n/i18n.mjs')).loadTranslator(locale);
 assert.equal(await page.locator('[data-i18n="sampleData"]').isVisible(),false);
 assert.equal(await page.locator('#resultCount').textContent(),translator.t('website.resultCount',{count:1}));
 await page.locator('#categories [data-cat="Repair"]').click();
 await page.waitForFunction(()=>document.querySelector('#results [data-provider-id]'));
 // Set the fixture value without queuing an input-driven request, so the
 // held request can only come from the keyboard form submission.
 await page.locator('#area').evaluate(input=>{input.value='Ahmedabad';});
 const held=new Promise(resolve=>{holdDiscovery=resolve;});
 try{
  await page.locator('#area').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#results').getAttribute('aria-busy')==='true');
  await held;
  assert.equal(await page.locator('#resultCount').textContent(),'');
  assert.equal(await page.locator('#providerPublicStatus').textContent(),translator.t('integration.read_loading'));
 }finally{releaseDiscovery?.();}
 await page.waitForFunction(()=>document.querySelector('#results [data-provider-id]'));
 for(const width of [320,375,768,1280]){
  await page.setViewportSize({width,height:850});
  for(const control of ['#searchBtn','#categories [data-cat="Repair"]','#results [data-provider-id]']){
   assert.ok((await page.locator(control).boundingBox()).height>=44,`${locale} ${width}px ${control}`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${locale} discovery ${width}px`);
 }
 await page.evaluate(async providerId=>{const {createMarketplaceNavigation}=await import('/features/marketplace/navigation-integration.mjs');window.navigation=createMarketplaceNavigation({enabled:true,providers:binding});if(!await navigation.go('provider',providerId))throw new Error('Provider route failed');},owned.providerId);await page.waitForFunction(()=>document.querySelector('#pName').textContent==='મૂળ Provider');assert.equal(await page.locator('#pServices').textContent().then(s=>s.includes('Repair')&&s.includes('Plumber')),true);
 assert.equal((await page.locator('#profileLink').inputValue()).endsWith('#provider/'+owned.providerId),true);
 assert.equal(await page.locator('#pAbout').textContent(),authored);
 for(const width of [320,375,768,1280]){
  await page.setViewportSize({width,height:850});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${locale} profile ${width}px`);
 }
 await page.evaluate(id=>navigation.go('enquiry',id),owned.providerId);assert.equal(await page.locator('#enquiryService').evaluate(n=>n===document.activeElement),true);await page.locator('#enquiryService').selectOption('Repair');await page.locator('#enquiryDescription').fill('ખાનગી buyer note');for(const language of ['hi','en','gu']){await page.locator('#localeSelect').selectOption(language);await page.waitForFunction(code=>document.documentElement.lang===code,language);assert.equal(await page.locator('#enquiryDescription').inputValue(),'ખાનગી buyer note');assert.equal(await page.locator('#enquiryService').inputValue(),'Repair');}await page.locator('#sampleEnquiryForm button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#trustedEnquiryLink').hidden);await page.locator('#trustedEnquiryLink').click();assert.equal((await page.evaluate(()=>openedEnquiry)).providerId,owned.providerId);assert.equal(await page.locator('#results').textContent().then(s=>s.includes('ખાનગી')),false);
 await page.reload();await boot();await page.waitForFunction(()=>document.querySelector('#pName').textContent==='મૂળ Provider');assert.equal(await page.locator('#enquiryDescription').inputValue(),'');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('#results [data-provider-id]'));await page.goForward();await page.waitForFunction(()=>document.querySelector('#pName').textContent==='મૂળ Provider');
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.waitForFunction(()=>document.querySelector('#pName').textContent==='');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator('#retryProviderRead').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#pName').textContent==='મૂળ Provider');
 await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await fake.seed(f.schema.actors,'journey-provider',{uid:'journey-provider',canWrite:true,suspended:true});await page.evaluate(()=>binding.restoreRoute());await page.waitForFunction(()=>document.querySelector('#pName').textContent==='');await fake.seed(f.schema.actors,'journey-provider',{uid:'journey-provider',canWrite:true,suspended:false});await page.evaluate(()=>binding.restoreRoute());await page.waitForFunction(()=>document.querySelector('#pName').textContent==='મૂળ Provider');
 f.uid('journey-provider');await f.owner.managePublication({requestId:'public-withdraw',expectedRevision:1,expectedGeneration:1,action:'withdraw'});f.uid('journey-buyer');await page.evaluate(()=>binding.restoreRoute());await page.waitForFunction(()=>document.querySelector('#pName').textContent==='');assert.equal(await page.locator('#copyProfileLink').isDisabled(),true);
 await page.evaluate(()=>binding.setSession(null));assert.equal(await page.locator('#enquiryDescription').inputValue(),'');assert.deepEqual(remote,[]);
 }finally{await context.close();}
});
