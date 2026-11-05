import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright-core';import {startPreviewServer} from './preview-server.mjs';
const main=await readFile(new URL('../../index.html',import.meta.url),'utf8'),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FQAAAABJRU5ErkJggg==','base64');let server,browser,origin;
before(async()=>{server=await startPreviewServer([]);origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
for(const kind of ['product','store'])for(const locale of ['gu','hi','en'])for(const width of [320,375])test(`authenticated ${kind} photo recovery ${locale} ${width}px`,async()=>{
 const context=await browser.newContext({viewport:{width,height:900}});let sends=0;const remote=[];
 try{
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){remote.push(url.href);return route.abort();}if(url.pathname==='/fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});return route.continue();});
  const page=await context.newPage();await page.exposeFunction('recordPhotoSend',()=>{sends++;return {status:202,body:{retrySameRequest:true}};});await page.goto(origin+'/fixture');
  const start=kind==='product'?main.indexOf('<div id="sellWizardPage"'):main.indexOf('<section id="storePage"'),end=kind==='product'?main.indexOf('    <!-- SKELETON LOADING SLIDE VIEW -->'):main.indexOf('</section>',start)+10;
  const markup=main.slice(start,end).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/\ssrc="[^"]*"/g,'');
  async function mount(){
   await page.setContent('<style>*{box-sizing:border-box}body{margin:8px}input,textarea,select,button{max-width:100%;min-height:44px;font:inherit}input,textarea,select{width:100%}button,p,span,label,legend{overflow-wrap:anywhere}#sellWizardPage,#storePage,#storeFormWrap,#wizardStage3,#wizardStage4{display:block!important}</style>'+markup);
   await page.evaluate(async({kind,locale})=>{
    const {mountMandatoryPhotos}=await import('/features/media/mandatory-photos-dom.mjs'),{createAuthenticatedPhotoClient}=await import('/features/media/authenticated-photo-client.mjs'),{loadTranslator}=await import('/features/i18n/i18n.mjs');const t=await loadTranslator(locale);
    window.revoked=false;const client=createAuthenticatedPhotoClient({enabled:true,getToken:async s=>window.revoked?null:{uid:s.uid,sessionId:s.sessionId,token:'private.synthetic.token'},sendUpload:async()=>window.recordPhotoSend(),sendCommand:async()=>({status:200,body:{ok:true,state:'quarantined',parentRevision:1,imageId:'image_12345678901234567890'}})});
    const input=document.getElementById(kind==='product'?'adImages':'storePhotoFile');window.binding=mountMandatoryPhotos({enabled:true,kind,input,container:input.closest('form'),mediaClient:client,translate:k=>t.t(k),makeRequestId:()=> 'stable-photo-request'});binding.setScope({uid:'owner',sessionId:'stable-session',parentId:'parent',revision:1});
   },{kind,locale});
  }
  await mount();const textId=kind==='product'?'adTitle':'storeShopName';await page.locator('#'+textId).fill('મૂળ Cafe\u0301 हिन्दी seller draft');
  const input=()=>page.locator('#'+(kind==='product'?'adImages':'storePhotoFile')),button=()=>page.locator('.oldx-photo-workflow button').first();
  await input().setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>binding.model.snapshot().items.length===1);
  await page.evaluate(()=>{const key=binding.model.snapshot().items[0].key;binding.model.upload(key);binding.model.upload(key);});await page.waitForFunction(()=>binding.model.snapshot().items[0].status==='retry');assert.equal(sends,1);
  const metadata=await page.evaluate(()=>JSON.stringify(history.state.oldxPhotoRecovery));assert.ok(!/token|blob:|bytes|base64/.test(metadata));
  await button().focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>binding.references().length===1);assert.equal(sends,1);assert.equal(await page.locator('#'+textId).inputValue(),'મૂળ Cafe\u0301 हिन्दी seller draft');
  await page.reload();await mount();assert.equal(await page.evaluate(()=>binding.model.snapshot().items.length),1);await button().click();await page.waitForFunction(()=>binding.references().length===1);assert.equal(sends,1);
  await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.evaluate(()=>binding.setScope(null));assert.equal(await page.locator('.oldx-photo-workflow img').count(),0);assert.equal(await page.evaluate(()=>Boolean(history.state.oldxPhotoRecovery?.[document.getElementById('adImages')?'product':'store'])),false);
  await page.evaluate(()=>{binding.setScope({uid:'other',sessionId:'other-session',parentId:'parent',revision:1});window.revoked=true;});await input().setInputFiles({name:'other.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>binding.model.snapshot().items.length===1);await button().click();await page.waitForFunction(()=>binding.model.snapshot().items[0].status==='retry');assert.equal(await page.evaluate(()=>binding.references().length),0);assert.equal(sends,1);assert.deepEqual(remote,[]);
 }finally{await context.close();}
});
