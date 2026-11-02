import test,{before,after,beforeEach,afterEach} from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {startPreviewServer} from './preview-server.mjs';
let server,browser,page,context,origin,errors,remote;
before(async()=>{server=await startPreviewServer(['service-inbox-preview.html','service-preview.html']);origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
beforeEach(async()=>{errors=[];remote=[];context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}return route.continue();});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/service-inbox-preview.html');await page.waitForFunction(()=>document.querySelectorAll('#inboxRows a').length===8);});
afterEach(async()=>{await context?.close();assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);});
async function language(code){await page.locator('#localeSelect').selectOption(code);await page.waitForFunction(code=>document.documentElement.lang===code,code);}
async function detail(id='p1-sample-1'){await page.evaluate(id=>{location.hash='#inbox/p1/enquiry/'+id;},id);await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);}
test('sample status/service filters compose and lists do not contain buyer notes or replies',async()=>{
 await page.locator('#inboxStatus').selectOption('new');assert.equal(await page.locator('#inboxRows a').count(),1);
 const second=await page.locator('#inboxService option').nth(2).getAttribute('value');await page.locator('#inboxService').selectOption(second);assert.equal(await page.locator('#inboxEmpty').isVisible(),true);
 await page.locator('#inboxStatus').selectOption('all');assert.equal(await page.locator('#inboxRows a').count(),4);
 assert.equal(await page.locator('#detailNote').textContent(),'');assert.equal(await page.locator('#detailReply').textContent(),'');
});
test('provider rehearses viewed/accepted/work/completion-requested without confirming completion or reviews',async()=>{
 await page.locator('#inboxRows a').first().click();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);
 for(const action of ['view','accept','start','request-completion'])await page.locator(`[data-action="${action}"]`).click();
 const gu=(await import('../../features/i18n/catalogs/gu.mjs')).default;assert.equal(await page.locator('#detailStatus').textContent(),gu['inbox.state.completion_requested']);
 assert.equal(await page.locator('[data-action="confirm-completion"]').count(),0);
 await page.locator('[data-action="cancel"]').click();assert.equal(await page.locator('#detailStatus').textContent(),gu['inbox.state.cancelled']);assert.equal(await page.locator('#previewReply').isDisabled(),true);
});
test('private local reply survives locale only, is absent from list and clears across provider scope',async()=>{
 await detail();const note=await page.locator('#detailNote').textContent();await page.locator('#inboxReply').fill('PRIVATE SAMPLE reply');
 for(const code of ['en','hi','gu']){await language(code);assert.equal(await page.locator('#inboxReply').inputValue(),'PRIVATE SAMPLE reply');assert.equal(await page.locator('#detailNote').textContent(),note);}
 await page.locator('#previewReply').click();assert.equal(await page.locator('#detailReply').textContent(),'PRIVATE SAMPLE reply');
 await page.locator('#inboxBack').click();await page.waitForFunction(()=>!document.querySelector('#inboxList').hidden);assert.equal((await page.locator('body').textContent()).includes('PRIVATE'),false);
 await page.locator('#sampleProvider').selectOption('p2');await page.waitForFunction(()=>location.hash==='#inbox/p2');
 await page.locator('#sampleProvider').selectOption('p1');await page.waitForFunction(()=>location.hash==='#inbox/p1');await detail();assert.equal(await page.locator('#detailReply').textContent(),'');
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['oldx.preview.locale.v1']);
});
test('cross-provider/missing links and withdrawal clear private fields and recover accessibly',async()=>{
 await detail();await page.locator('#inboxReply').fill('PRIVATE unsent note');
 await page.locator('#withdrawProvider').check();assert.equal(await page.locator('#inboxUnavailable').isVisible(),true);assert.equal(await page.locator('#detailNote').textContent(),'');assert.equal(await page.locator('#inboxReply').inputValue(),'');
 await page.locator('#withdrawProvider').uncheck();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);
 for(const hash of ['#inbox/p1/enquiry/p2-sample-1','#inbox/p1/enquiry/missing','#inbox/%2Fprivate']){await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForFunction(()=>!document.querySelector('#inboxUnavailable').hidden);assert.equal(await page.locator('#detailNote').textContent(),'');assert.equal(await page.locator('#unavailableHeading').evaluate(n=>n===document.activeElement),true);}
});
test('history navigation restores list focus and stale reply data does not survive page lifecycle',async()=>{
 await page.locator('#inboxRows a').first().click();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);await page.goBack();await page.waitForFunction(()=>!document.querySelector('#inboxList').hidden);assert.equal(await page.locator('#inboxRows a').first().evaluate(n=>n===document.activeElement),true);
 await page.goForward();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);await page.locator('#inboxReply').fill('PRIVATE draft');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await page.locator('#inboxReply').inputValue(),'');assert.equal(await page.locator('#detailNote').textContent(),'');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.equal(await page.locator('#inboxReply').inputValue(),'');
});
test('all inbox views support 320px, doubled text, labelled controls and keyboard navigation in three locales',async()=>{
 await page.setViewportSize({width:320,height:900});
 for(const code of ['gu','hi','en']){await language(code);for(const hash of ['#inbox/p1','#inbox/p1/enquiry/p1-sample-1','#inbox/p1/enquiry/missing']){
  await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForFunction(hash=>location.hash===hash,hash);
  await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('input,select,textarea')].filter(n=>n.getClientRects().length&&!n.labels.length).map(n=>n.id)),[]);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<44).map(n=>n.id)),[]);
  await page.evaluate(()=>document.querySelectorAll('body *').forEach(n=>n.style.removeProperty('font-size')));
 }}
 await page.locator('.skip').focus();const hash=new URL(page.url()).hash;await page.keyboard.press('Enter');assert.equal(await page.locator('#main').evaluate(n=>n===document.activeElement),true);assert.equal(new URL(page.url()).hash,hash);
});

test('unsafe local reply is rejected accessibly without exposing markup or losing permitted detail',async()=>{
 await detail();await page.locator('#inboxReply').fill('<img src=x onerror=alert(1)>');await page.locator('#previewReply').click();assert.equal(await page.locator('#inboxReply').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#inboxReply').evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('#inboxDetail').isVisible(),true);assert.equal(await page.locator('#inboxDetail img').count(),0);
 await page.locator('#inboxReply').fill('W'.repeat(400));await page.locator('#previewReply').click();await page.setViewportSize({width:320,height:900});assert.equal(await page.locator('#detailReply').textContent(),'W'.repeat(400));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
