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
   window.calls=[];
   const fetchImpl=async(url,options)=>{
    calls.push(url);
    if(options.headers.Authorization!=='Bearer admin.fixture.token')return {ok:false,status:403,json:async()=>({ok:false})};
    if(url.includes('pageToken='))return new Promise(resolve=>window.releasePage=()=>resolve({ok:true,status:200,json:async()=>({ok:true,data:{items:[{displayName:'Stale private row'}]}})}));
    return {ok:true,status:200,json:async()=>({ok:true,data:{items:[{displayName:'મૂળ हिन्दी <script>',status:'active',email:'never-render'}],nextPageToken:'signed-page'}})};
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
  await page.getByRole('button',{name:'Next page'}).click();
  await page.waitForFunction(()=>typeof releasePage==='function');
  await page.evaluate(()=>{switchAdmin('ordinary');releasePage();});
  await page.getByText('User directory access denied.').waitFor();
  assert.equal(await page.locator('#adminUsersTableBody tr').count(),0);
  await page.evaluate(()=>switchAdmin(null));
  assert.equal(await page.locator('#adminUsersTableBody tr').count(),0);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
