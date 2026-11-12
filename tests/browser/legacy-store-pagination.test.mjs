import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {startPreviewServer} from './preview-server.mjs';
const source=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function storeCatalogueCopy(key)'),source.indexOf('function escapeStoreHtml('));
let server,browser,origin;
before(async()=>{server=await startPreviewServer([]);origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
for(const locale of ['gu','hi','en'])test('actual legacy Store paging/filter/retry/stale scope at mobile '+locale,async()=>{
 const context=await browser.newContext({viewport:{width:locale==='gu'?320:375,height:900}}),remote=[],page=await context.newPage();
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});});
 try{
  await page.goto(origin+'/fixture');await page.setContent('<html lang="'+locale+'"><style>*{box-sizing:border-box}body{margin:8px}button,select,input{max-width:100%;min-height:44px}p{overflow-wrap:anywhere}#storeProductsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}</style><input id="storeProductSearch" aria-label="Search"><select id="storeProductSort" aria-label="Sort"><option value="newest">Newest</option><option value="name">Name</option></select><div id="storeCategoryFilters"><button data-store-category="all">All</button></div><p id="storeProductsCount"></p><div id="storeProductsGrid"></div></html>');
  await page.addScriptTag({content:'let storeCatalogueGeneration=0,storeCatalogueState=null,currentStoreProductsCache=[];window.pending=[];window.queries=[];window.firebase={firestore:{FieldPath:{documentId:()=>"__name__"}}};window.createProductCard=p=>{const card=document.createElement("article");card.dataset.id=p.docId;card.textContent=p.title;return card;};window.db={collection:name=>{const request={name};const q={where:(...v)=>{request.where=v;return q;},orderBy:field=>{request.order=field;return q;},limit:n=>{request.limit=n;return q;},startAfter:doc=>{request.after=doc.id;return q;},get:()=>{queries.push(request);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};return q;}};'+code});
  await page.evaluate(()=>{window.answer=(i,count,owner='one',prefix='item')=>pending[i].resolve({docs:Array.from({length:count},(_,n)=>({id:prefix+n,data:()=>({sellerUid:owner,docId:'forged',title:'મૂળ हिन्दी '+prefix+n})}))});startStoreCatalogue('one');});
  assert.equal(await page.locator('[data-store-category="all"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#storeProductsCount').textContent(),await page.evaluate(()=>storeCatalogueCopy('loading')));
  await page.evaluate(()=>answer(0,24));await page.waitForFunction(()=>document.querySelectorAll('article').length===24);
  assert.equal(await page.locator('article').first().getAttribute('data-id'),'item0');assert.equal(await page.evaluate(()=>queries[0].limit),24);
  const button=page.locator('#storeCataloguePaging button');await button.click();await page.evaluate(()=>answer(1,1,'one','next'));await page.waitForFunction(()=>document.querySelectorAll('article').length===25);assert.equal(await button.isVisible(),false);assert.equal(await page.evaluate(()=>queries[1].after),'item23');
  await page.locator('#storeProductSearch').fill('next');await page.evaluate(()=>filterStoreProducts('all'));assert.equal(await page.locator('article').count(),1);await page.locator('#storeProductSearch').fill('');
  await page.evaluate(()=>startStoreCatalogue('old'));await page.evaluate(()=>startStoreCatalogue('current'));await page.evaluate(()=>answer(3,1,'current','current'));await page.waitForFunction(()=>document.querySelector('article')?.dataset.id==='current0');await page.evaluate(()=>answer(2,24,'old','old'));assert.equal(await page.locator('article').count(),1);assert.equal(await page.locator('article').first().getAttribute('data-id'),'current0');
  await page.evaluate(()=>startStoreCatalogue('retry'));await page.evaluate(()=>pending[4].reject(Error('private failure')));await page.waitForFunction(()=>!document.querySelector('#storeCataloguePaging button').disabled);await page.locator('#storeCataloguePaging button').click();await page.evaluate(()=>answer(5,1,'retry','retry'));await page.waitForFunction(()=>document.querySelector('article')?.dataset.id==='retry0');
  await page.evaluate(()=>startStoreCatalogue('empty'));
  assert.equal(await page.locator('#storeProductsCount').textContent(),await page.evaluate(()=>storeCatalogueCopy('loading')));
  await page.evaluate(()=>pending[6].reject(Error('private failure')));
  await page.waitForFunction(()=>!document.querySelector('#storeCataloguePaging button').disabled);
  assert.equal(await page.locator('#storeProductsCount').textContent(),await page.evaluate(()=>storeCatalogueCopy('unavailable')));
  await page.locator('#storeCataloguePaging button').click();
  await page.evaluate(()=>answer(7,0,'empty'));
  await page.waitForFunction(()=>document.querySelector('#storeCataloguePaging button').hidden);
  assert.equal(await page.locator('#storeProductsGrid').textContent(),await page.evaluate(()=>storeCatalogueCopy('noProducts')));
  await page.evaluate(()=>document.body.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(remote,[]);
 }finally{await context.close();}
});

test('actual legacy Product card ignores forged verification flags while retaining save, chat and stock UI',async()=>{
 const context=await browser.newContext({viewport:{width:320,height:900}}),page=await context.newPage();
 await context.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 try{await page.goto(origin+'/fixture');const card=source.slice(source.indexOf('function createProductCard('),source.indexOf('    </script>',source.indexOf('function createProductCard(')));await page.addScriptTag({content:'window.getSavedAdsStorageKey=()=>"synthetic";window.toggleCartProduct=id=>window.saved=id;window.openProductDetailPage=id=>window.opened=id;window.startChatWithSeller=()=>{};window.triggerHaptic=()=>{};'+card});await page.evaluate(()=>document.body.append(createProductCard({docId:'canonical',title:'મૂળ हिन्दी',location:'Local',category:'cars',finalPriceStr:'100',isFeatured:true,isShopVerified:true,isSold:false,images:[]})));assert.equal((await page.locator('body').textContent()).includes('VERIFIED'),false);assert.equal((await page.locator('body').textContent()).includes('FEATURED'),false);await page.locator('[data-save-button]').click();assert.equal(await page.evaluate(()=>saved),'canonical');assert.equal(await page.locator('[data-card-title]').textContent(),'મૂળ हिन्दी');assert.equal(await page.locator('[data-card-buy]').isVisible(),true);
 }finally{await context.close();}
});
