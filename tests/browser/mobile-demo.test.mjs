import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {startPreviewServer} from './preview-server.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildVisualReview} from '../../scripts/build-visual-review.mjs';
let browser,server,origin;before(async()=>{server=await startPreviewServer(['mobile-demo.html']);origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});});after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
for(const width of [320,375])for(const locale of ['gu','hi','en'])test(`isolated Android-sized demo navigation/local interactions ${width} ${locale}`,async()=>{
 const context=await browser.newContext({viewport:{width,height:820}}),page=await context.newPage(),external=[],errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
 try{
 await page.goto(origin+'/mobile-demo.html');await page.locator('#language').selectOption(locale);await page.waitForFunction(l=>document.documentElement.lang===l,locale);await page.waitForSelector('.card');
 const original=await page.locator('.card h3').first().textContent();assert.ok(original.includes('ખુરશી'));assert.equal(await page.locator('.art img').first().evaluate(img=>img.complete&&img.naturalWidth>0),true);
 await page.locator('.card a').first().click();await page.waitForSelector('.detail');assert.equal(await page.locator('.detail h2').textContent(),original);await page.locator('.detail button').first().click();await page.locator('.detail a[href="#stores"]').click();await page.waitForSelector('.panel h2');assert.ok((await page.locator('.panel h2').textContent()).includes('કિરણ'));
 await page.locator('nav a[href="#services"]').click();await page.waitForSelector('.service-icon');await page.locator('.card a').first().click();await page.waitForURL(url=>url.hash==='#provider/p1');await page.locator('.card button').click();await page.waitForSelector('textarea');
 await page.locator('textarea').fill('મૂળ हिन्दी hello');await page.locator('form button').click();await page.waitForFunction(()=>document.querySelector('.conversation')?.textContent.includes('મૂળ हिन्दी hello'));assert.equal(await page.locator('textarea').inputValue(),'');
 await page.locator('.actions button').first().click();assert.equal(await page.locator('textarea').isDisabled(),true);await page.locator('.actions button').first().click();assert.equal(await page.locator('textarea').isDisabled(),false);
 await page.locator('nav a[href="#admin"]').click();await page.waitForSelector('.row');await page.locator('.row button').first().click();await page.locator('nav a[href="#home"]').click();await page.waitForSelector('.card');assert.equal(await page.locator('.card h3').filter({hasText:original}).count(),0);
 await page.locator('.hero a[href="#post"]').click();await page.waitForSelector('input[type=file]');await page.locator('input[type=text]').fill('મૂળ private sample');await page.locator('input[type=number]').fill('150');
 await page.locator('input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});await page.waitForSelector('#photoPreview img');await page.locator('form button[type=submit]').click();assert.ok(await page.locator('#feedback').textContent());await page.locator('#photoPreview button').click();assert.equal(await page.locator('#photoPreview img').count(),0);
 await page.goBack();await page.waitForURL(url=>url.hash==='#home');await page.goForward();await page.waitForURL(url=>url.hash==='#post');
 await page.evaluate(()=>document.documentElement.style.fontSize='32px');assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'32px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));
 await page.reload();await page.waitForSelector('form');assert.equal(await page.locator('input[type=text]').inputValue(),'');assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await page.goto(origin+'/mobile-demo.html#product/%3Cscript%3E');await page.waitForSelector('main h1');assert.equal(await page.locator('main script').count(),0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('packaged visual review uses real homepage markup and isolated synthetic journeys at all review widths',async()=>{
 const out=await mkdtemp(join(tmpdir(),'oldx-visual-test-'));
 const sha='a'.repeat(40);
 let reviewServer;
 try{
  const readSource=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
  const paths=await buildVisualReview({readSource,sha,date:'2026-11-12',out});
  const served=new Set(paths.filter(path=>!path.startsWith('_')));
  const headers=Object.fromEntries((await readFile(join(out,'_headers'),'utf8')).trimEnd().split('\n').slice(1).map(line=>{
   const separator=line.indexOf(':');return [line.slice(0,separator).trim(),line.slice(separator+1).trim()];
  }));
  reviewServer=await startPreviewServer([],async(path,req,res)=>{
   const file=path==='/'?'index.html':path.slice(1);
   const allowed=req.method==='GET'&&served.has(file);
   const type=file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';
   res.writeHead(allowed?200:404,{...headers,'Content-Type':type+'; charset=utf-8'});
   res.end(await readFile(join(out,allowed?file:'404.html')));
   return true;
  });
  const base='http://127.0.0.1:'+reviewServer.address().port;
  const context=await browser.newContext(),page=await context.newPage(),unexpected=[],errors=[];
  page.setDefaultTimeout(5000);
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==base||request.method()!=='GET'||url.pathname!=='/'&&!served.has(url.pathname.slice(1))){
    unexpected.push(url.href);return route.abort();
   }
   return route.continue();
  });
  try{
   for(const width of [320,375,768,1280]){
    await page.setViewportSize({width,height:850});
    await page.goto(base);
    await page.locator('#oldxHomeHero').waitFor();
    assert.match(await page.getByRole('note').textContent(),new RegExp('SYNTHETIC PREVIEW.*'+sha+'.*2026-11-12'));
    for(const locale of ['gu','hi','en']){
     const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
     await page.locator('#language').selectOption(locale);
     await page.waitForFunction(title=>document.querySelector('#oldxHomeHero h2')?.textContent===title,catalog['market.home.hero']);
     assert.equal(await page.locator('#searchInput').getAttribute('aria-label'),catalog['market.search']);
     assert.equal(await page.locator('html').getAttribute('lang'),locale);
     await page.locator('.card a[href^="#product/"]').first().click();
     await page.locator('.detail').waitFor();
     assert.match(await page.locator('.detail h2').textContent(),/ખુરશી/);
     await page.locator('.detail a[href="#stores"]').click();
     await page.locator('.panel').waitFor();
     await page.locator('nav a[href="#services"]').click();
     await page.locator('.card a[href^="#provider/"]').first().click();
     await page.locator('.card button').click();
     await page.locator('textarea').fill('મૂળ हिन्दी sample');
     await page.locator('form button').click();
     assert.match(await page.locator('.conversation').textContent(),/મૂળ हिन्दी sample/);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
     await page.locator('nav a[href="#home"]').click();
    }
   }
   for(const route of ['#admin','#post']){
    await page.goto(base+'/'+route);await page.locator('main h1').waitFor();
    assert.equal(await page.locator('main form, nav a[href="#admin"]').count(),0);
   }
   assert.deepEqual(unexpected,[]);
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
   for(const path of ['/firebase-env.js','/.firebaserc','/.git/config','/api/staging/marketplace/owner','/service-preview.html']){
    assert.equal((await context.request.get(base+path)).status(),404,path);
   }
  }finally{await context.close();}
 }finally{
  if(reviewServer)await new Promise(resolve=>reviewServer.close(resolve));
  await rm(out,{recursive:true,force:true});
 }
});
