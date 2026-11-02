import test,{before,after,beforeEach,afterEach} from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {startPreviewServer} from './preview-server.mjs';
let server,browser,context,page,origin,errors,remote;
before(async()=>{server=await startPreviewServer(['service-buyer-preview.html','service-inbox-preview.html','service-preview.html']);origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
beforeEach(async()=>{errors=[];remote=[];context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/service-buyer-preview.html');await page.waitForFunction(()=>document.querySelectorAll('#inboxRows a').length===8);});
afterEach(async()=>{await context?.close();assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);});
async function route(hash,view='inboxDetail'){await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForFunction(id=>!document.getElementById(id).hidden,view);}
const detail=id=>route('#buyer/sample-buyer-1/provider/p1/enquiry/'+id);
test('buyer tracks only owned status/service summaries and reads sample provider responses',async()=>{
 assert.equal(await page.locator('a[data-enquiry-id="p1-sample-2"]').count(),0);await page.locator('#inboxStatus').selectOption('completion-requested');assert.equal(await page.locator('#inboxRows a').count(),1);
 await page.locator('#inboxRows a').click();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);assert.ok((await page.locator('#detailReply').textContent()).includes('Sample response only'));assert.equal(await page.locator('#sampleReplyForm').isVisible(),false);
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
});
test('buyer cancellation and disputes use canonical transitions and local history without review grants',async()=>{
 await detail('p1-sample-1');await page.locator('[data-action="cancel"]').click();const gu=(await import('../../features/i18n/catalogs/gu.mjs')).default;assert.equal(await page.locator('#detailStatus').textContent(),gu['inbox.state.cancelled']);assert.equal(await page.locator('#sampleHistory li').count(),1);assert.equal(await page.locator('#inboxActions button').count(),0);
 await detail('p1-sample-4');await page.locator('[data-action="dispute"]').click();assert.equal(await page.locator('#detailStatus').textContent(),gu['inbox.state.disputed']);assert.equal(await page.locator('#inboxActions button').count(),0);
});
test('completion confirmation is an explicit two-step rehearsal with cancel and no actual review eligibility',async()=>{
 await detail('p1-sample-5');const gu=(await import('../../features/i18n/catalogs/gu.mjs')).default;
 await page.locator('[data-action="confirm-completion"]').click();assert.equal(await page.locator('#buyerConfirmation').isVisible(),true);assert.equal(await page.locator('#confirmBuyerSample').evaluate(n=>n===document.activeElement),true);
 await page.locator('#cancelBuyerConfirmation').click();assert.equal(await page.locator('#detailStatus').textContent(),gu['inbox.state.completion_requested']);
 await page.locator('[data-action="confirm-completion"]').click();await page.locator('#confirmBuyerSample').click();assert.equal(await page.locator('#detailStatus').textContent(),gu['inbox.state.completed']);assert.equal(await page.locator('#inboxActions button').count(),0);assert.equal(await page.locator('#buyerConfirmation').isVisible(),false);
 assert.equal(await page.locator('[data-review-eligible]').count(),0);assert.equal(await page.locator('#detailHeading').evaluate(n=>n===document.activeElement),true);
});
test('cross-buyer/provider links, revoked profiles and identity changes clear detail/history',async()=>{
 await detail('p1-sample-1');await page.locator('[data-action="cancel"]').click();
 for(const hash of ['#buyer/sample-buyer-1/provider/p1/enquiry/p1-sample-2','#buyer/sample-buyer-1/provider/p2/enquiry/p1-sample-1','#buyer/unknown/provider/p1','#buyer/%2Fprivate/provider/p1']){await route(hash,'inboxUnavailable');assert.equal(await page.locator('#detailNote').textContent(),'');assert.equal(await page.locator('#detailReply').textContent(),'');assert.equal(await page.locator('#sampleHistory li').count(),0);}
 await route('#buyer/sample-buyer-1/provider/p1','inboxList');await page.locator('#sampleBuyer').selectOption('sample-buyer-2');await page.waitForFunction(()=>document.querySelectorAll('#inboxRows a').length===1);assert.equal(await page.locator('#inboxRows a').getAttribute('data-enquiry-id'),'p1-sample-2');
 await page.locator('#withdrawProvider').check();assert.equal(await page.locator('#inboxUnavailable').isVisible(),true);assert.equal(await page.locator('#detailNote').textContent(),'');
});
test('history navigation retains only same-scope local changes and page-hide cancels queued preparation',async()=>{
 await page.locator('#inboxRows a').first().click();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);await page.locator('[data-action="cancel"]').click();await page.goBack();await page.waitForFunction(()=>!document.querySelector('#inboxList').hidden);assert.equal(await page.locator('#inboxRows a').first().evaluate(n=>n===document.activeElement),true);await page.goForward();await page.waitForFunction(()=>!document.querySelector('#inboxDetail').hidden);assert.equal(await page.locator('#sampleHistory li').count(),1);
 const busy=await page.evaluate(()=>{location.hash='#buyer/sample-buyer-1/provider/p1/enquiry/p1-sample-5';window.dispatchEvent(new HashChangeEvent('hashchange'));const value=document.querySelector('#inboxDetail').getAttribute('aria-busy');window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));return value;});assert.equal(busy,'true');assert.equal(await page.locator('#detailNote').textContent(),'');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.equal(await page.locator('#sampleHistory li').count(),1);assert.ok((await page.locator('#sampleHistory li').textContent()).length>0);
});
test('buyer views and confirmation support gu/hi/en, 320px, doubled text and labelled keyboard controls',async()=>{
 await page.setViewportSize({width:320,height:900});
 for(const code of ['gu','hi','en']){await page.locator('#localeSelect').selectOption(code);await page.waitForFunction(code=>document.documentElement.lang===code,code);
  for(const [hash,view] of [['#buyer/sample-buyer-1/provider/p1','inboxList'],['#buyer/sample-buyer-1/provider/p1/enquiry/p1-sample-5','inboxDetail'],['#buyer/sample-buyer-1/provider/p1/enquiry/missing','inboxUnavailable']]){await route(hash,view);if(view==='inboxDetail')await page.locator('[data-action="confirm-completion"]').click();
   await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('input,select,textarea')].filter(n=>n.getClientRects().length&&!n.labels.length).map(n=>n.id)),[]);assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<44).map(n=>n.id)),[]);await page.evaluate(()=>document.querySelectorAll('body *').forEach(n=>n.style.removeProperty('font-size')));
  }
 }
 await page.locator('.skip').focus();const hash=new URL(page.url()).hash;await page.keyboard.press('Enter');assert.equal(await page.locator('#main').evaluate(n=>n===document.activeElement),true);assert.equal(new URL(page.url()).hash,hash);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['oldx.preview.locale.v1']);
});
