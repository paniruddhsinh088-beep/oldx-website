import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {startPreviewServer} from './preview-server.mjs';

test('Admin user directory is opt-in, paged and clears private rows on account change',async()=>{
 const server=await startPreviewServer([]);
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:320,height:800}});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.route(origin+'/admin-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await page.goto(origin+'/admin-test');
  const html=await readFile(new URL('../../admin.html',import.meta.url),'utf8');
  await page.setContent(html.match(/<p id="adminBackendStatus"[^>]*>[^<]*<\/p>/)[0]+html.slice(html.indexOf('<div id="adminUsersSection"'),html.indexOf('</main>')));
  await page.evaluate(async()=>{
   document.getElementById('adminUsersSection').style.display='block';
   const {mountAdminUsers}=await import('/features/admin/users-panel.mjs');
   let observe;
   const auth={app:{options:{projectId:'oldx-staging'}},currentUser:null,onIdTokenChanged(fn){observe=fn;fn(null);return ()=>{};}};
   window.calls=[];window.directoryRevoked=false;
   const fetchImpl=async(url,options)=>{
    calls.push(url);
    if(directoryRevoked||options.headers.Authorization!=='Bearer admin.fixture.token')return {ok:false,status:403,json:async()=>({ok:false})};
    if(url.includes('pageToken='))return new Promise(resolve=>window.releasePage=()=>resolve({ok:true,status:200,json:async()=>({ok:true,data:{items:[{displayName:'Stale private row'}]}})}));
    return {ok:true,status:200,json:async()=>({ok:true,data:{items:[{displayName:'મૂળ हिन्दी <script>',status:'active',email:'never-render'}],nextPageToken:'signed.page'}})};
   };
   if(mountAdminUsers({auth,fetchImpl})!==null)throw Error('Must remain off');
   window.panel=mountAdminUsers({enabled:true,auth,fetchImpl});
   window.switchAdmin=uid=>{auth.currentUser=uid?{uid,getIdToken:async()=>uid+'.fixture.token'}:null;observe(auth.currentUser);};
  });
  assert.equal(await page.evaluate(()=>calls.length),0);
  await page.evaluate(()=>switchAdmin('admin'));
  await page.getByText('મૂળ हिन्दी <script>',{exact:true}).waitFor();
  assert.equal(await page.getByText('never-render').count(),0);
  assert.deepEqual(await page.evaluate(()=>calls),['/api/admin/users?pageSize=20']);
  await page.evaluate(()=>{directoryRevoked=true;window.dispatchEvent(new Event('focus'));});
  assert.equal(await page.locator('#adminUsersTableBody tr').count(),0,'refocus clears previously authorized rows before revalidation');
  await page.getByText('User directory access denied.').waitFor();
  assert.equal(await page.getByRole('button',{name:'Next page'}).isHidden(),true);
  await page.evaluate(()=>{directoryRevoked=false;window.dispatchEvent(new Event('focus'));});
  await page.getByText('મૂળ हिन्दी <script>',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Next page'}).click();
  await page.waitForFunction(()=>typeof releasePage==='function');
  await page.evaluate(()=>{switchAdmin('ordinary');releasePage();});
  await page.getByText('User directory access denied.').waitFor();
  assert.equal(await page.locator('#adminUsersTableBody tr').count(),0);
  await page.evaluate(()=>switchAdmin(null));
  assert.equal(await page.locator('#adminUsersTableBody tr').count(),0);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});

for(const [locale,width,nextLabel] of [['en',375,'Next page'],['gu',320,'આગળનું પેજ'],['hi',375,'अगला पेज']])test('Admin Product moderation is bounded and read-only '+locale,async()=>{
 const server=await startPreviewServer([]);
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width,height:800}});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.route(origin+'/products-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await page.goto(origin+'/products-test');
  const html=await readFile(new URL('../../admin.html',import.meta.url),'utf8');
  await page.setContent('<style>table{width:100%;table-layout:fixed;overflow-wrap:anywhere}</style>'+html.slice(html.indexOf('<div id="adminAdsSection"'),html.indexOf('<!-- SECTION 2:')));
  await page.evaluate(async locale=>{
   document.documentElement.lang=locale;
   const {mountAdminProducts}=await import('/features/admin/users-panel.mjs');
   let observe;window.calls=[];window.mode='valid';
   const auth={app:{options:{projectId:'oldx-staging'}},currentUser:null,onIdTokenChanged(fn){observe=fn;fn(null);return ()=>{};}};
   const result=data=>({ok:true,status:200,json:async()=>({ok:true,data})});
   const fetchImpl=async(url,options)=>{
    calls.push([url,options.method]);
    if(options.headers.Authorization!=='Bearer admin.fixture.token'||mode==='revoked')return {ok:false,status:403,json:async()=>({ok:false})};
    if(url.includes('pageToken='))return result({items:[],nextPageToken:null});
    return result({items:[{title:'મૂળ हिन्दी Product',category:'cars',finalPriceStr:'₹50',sellerUid:'omit-seller',location:'omit-location',phone:'omit-phone'}],nextPageToken:mode==='invalid'?'malformed':'signed.page'});
   };
   if(mountAdminProducts({auth,fetchImpl})!==null)throw Error('Must remain off');
   mountAdminProducts({enabled:true,auth,fetchImpl});
   window.switchProductAccount=uid=>{auth.currentUser=uid?{uid,getIdToken:async()=>uid+'.fixture.token'}:null;observe(auth.currentUser);};
  },locale);
  assert.equal(await page.evaluate(()=>calls.length),0);
  await page.evaluate(()=>switchProductAccount('ordinary'));
  await page.waitForFunction(()=>calls.length===1);
  assert.equal(await page.locator('#adminAdsTableBody tr').count(),0);
  await page.evaluate(()=>switchProductAccount('admin'));
  await page.getByText('મૂળ हिन्दी Product',{exact:true}).waitFor();
  assert.deepEqual(await page.locator('#adminAdsTableBody td').allTextContents(),['મૂળ हिन्दी Product','cars','₹50']);
  assert.equal(await page.locator('#adminSearchAds').isHidden(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.getByRole('button',{name:nextLabel}).click();
  await page.waitForFunction(()=>calls.some(([url])=>url.endsWith('pageToken=signed.page')));
  assert.equal(await page.locator('#adminAdsTableBody tr').count(),0);
  await page.evaluate(()=>{mode='invalid';window.dispatchEvent(new Event('focus'));});
  await page.getByText({en:'Product list unavailable.',gu:'પ્રોડક્ટ સૂચિ ઉપલબ્ધ નથી.',hi:'उत्पाद सूची उपलब्ध नहीं है।'}[locale],{exact:true}).waitFor();
  assert.equal(await page.locator('#adminAdsTableBody tr').count(),0);
  assert.equal(await page.getByRole('button',{name:nextLabel}).isHidden(),true);
  await page.evaluate(()=>{mode='valid';window.dispatchEvent(new Event('focus'));});
  await page.getByText('મૂળ हिन्दी Product',{exact:true}).waitFor();
  await page.evaluate(()=>{mode='revoked';window.dispatchEvent(new Event('focus'));});
  await page.waitForFunction(()=>calls.length===6);
  assert.equal(await page.locator('#adminAdsTableBody tr').count(),0);
  await page.evaluate(()=>switchProductAccount(null));
  assert.equal(await page.locator('#adminAdsTableBody tr').count(),0);
  assert.equal(await page.evaluate(()=>calls.every(([url,method])=>url.startsWith('/api/admin/products?pageSize=20')&&method==='GET')),true);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
