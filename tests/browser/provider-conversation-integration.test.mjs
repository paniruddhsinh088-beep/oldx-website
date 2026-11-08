import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {startPreviewServer} from './preview-server.mjs';
import {fakeFirestoreSdk} from '../integration/fake-firestore-sdk.mjs';
import {providerJourneyFixture} from '../integration/provider-journey-acceptance.mjs';
let server,browser,origin;
before(async()=>{server=await startPreviewServer(['service-preview.html','service-inbox-preview.html','service-conversation-preview.html']);origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
for(const locale of ['gu','hi','en'])test('trusted enquiry to inbox conversation, reply replay and participant recovery '+locale,async()=>{
 const context=await browser.newContext({viewport:{width:locale==='gu'?320:375,height:900}});
 try{
 const remote=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}return route.continue();});
 const page=await context.newPage(),fake=fakeFirestoreSdk(),f=await providerJourneyFixture({sdk:fake.sdk,db:fake.db,seed:(...a)=>fake.seed(...a)});
 await f.owner.saveDraft({requestId:'handoff-draft',expectedRevision:0,profile:f.profile});const owned=await f.owner.bootstrap({operation:null,requestId:null});await f.owner.managePublication({requestId:'handoff-publish',expectedRevision:1,expectedGeneration:0,action:'publish'});f.uid('journey-buyer');
 await page.exposeFunction('privateExecute',(op,body)=>f.execute(op,body));await page.exposeFunction('publicDetail',r=>f.publicReads.detail(r));
 await page.goto(origin+'/service-preview.html#provider/'+owned.providerId);
 await page.evaluate(async locale=>{const {configureProviderIntegration}=await import('/features/service-providers/service-preview.mjs'),{createProviderHost}=await import('/features/service-providers/host-integration.mjs');const host=createProviderHost({enabled:true,openPage:({page,hash})=>location.assign('./'+page+hash)});window.binding=configureProviderIntegration({enabled:true,reads:{detail:r=>publicDetail(r)},buyer:{commands:{execute:(op,body)=>privateExecute(op,body)}},openPrivateEnquiry:v=>host.navigation.openInbox(v)});binding.setSession({uid:'journey-buyer',sessionId:'buyer',revision:0,generation:0});document.querySelector('#localeSelect').value=locale;document.querySelector('#localeSelect').dispatchEvent(new Event('change'));},locale);
 await page.waitForFunction(()=>document.querySelector('#pName').textContent==='મૂળ Provider');await page.locator('#enquiryService').selectOption('Repair');await page.locator('#enquiryDescription').fill('ખાનગી buyer note हिन्दी');await page.locator('#sampleEnquiryForm button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#trustedEnquiryLink').hidden);await page.locator('#trustedEnquiryLink').click();await page.waitForURL('**/service-inbox-preview.html#inbox/**');
 async function inbox(audience){await page.evaluate(async({audience,locale})=>{const {mountProviderPrivateIntegration}=await import('/features/service-providers/private-integration-dom.mjs'),{createProviderHost}=await import('/features/service-providers/host-integration.mjs'),{loadTranslator}=await import('/features/i18n/i18n.mjs');const t=await loadTranslator(locale),host=createProviderHost({enabled:true,audience,openPage:({page,hash})=>location.assign('./'+page+hash)});window.binding=mountProviderPrivateIntegration({enabled:true,audience,translate:key=>t.t(key),execute:(op,body)=>privateExecute(op,body),openConversation:v=>host.navigation.openConversation(v)});await binding.setSession({uid:'journey-'+audience,sessionId:audience});},{audience,locale});}
 async function conversation(audience){await page.evaluate(async({audience,locale})=>{const {mountProviderConversation}=await import('/features/service-providers/private-conversation-dom.mjs'),{createProviderHost}=await import('/features/service-providers/host-integration.mjs'),{loadTranslator}=await import('/features/i18n/i18n.mjs');const t=await loadTranslator(locale),host=createProviderHost({enabled:true,audience,openPage:({page,hash})=>location.assign('./'+page+hash)});window.binding=mountProviderConversation({enabled:true,audience,translate:key=>t.t(key),execute:(op,body,context)=>privateExecute(op,body),openInbox:v=>host.navigation.openInbox(v)});await binding.setSession({uid:'journey-'+audience,sessionId:audience});},{audience,locale});}
 await inbox('buyer');await page.waitForFunction(()=>document.querySelector('#detailNote').textContent.includes('buyer note'));await page.locator('#conversationLink').click();await page.waitForURL('**/service-conversation-preview.html#conversation/buyer/**');await conversation('buyer');assert.equal(await page.locator('#messages').textContent().then(s=>s.includes('ખાનગી buyer note हिन्दी')),true);assert.equal(await page.locator('#draftForm').isHidden(),true);
 const enquiryId=await page.evaluate(()=>binding.model.snapshot().selection.enquiryId);f.uid('journey-provider');await page.goto(origin+'/service-conversation-preview.html#conversation/provider/'+owned.providerId+'/'+enquiryId);await conversation('provider');await page.locator('#messageDraft').fill('મૂળ જવાબ हिन्दी');f.loseAck();await page.locator('#previewDraft').click();await page.waitForFunction(()=>binding.model.snapshot().canRetry);assert.equal(await page.locator('#messageDraft').getAttribute('readonly')!==null,true);await page.locator('#conversationRetryCommand').click();await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('મૂળ જવાબ हिन्दी'));assert.equal(await page.locator('#messages li').count(),2);
 for(let revision=2;revision<=21;revision++){const changed=await f.execute('enquiry.change',{providerId:owned.providerId,enquiryId,expectedRevision:revision-1,requestId:'history-'+revision,action:'reply',reply:'History '+revision});assert.equal(changed.status,200);}
 await page.reload();await conversation('provider');assert.equal(await page.locator('#messages li').count(),20);await page.locator('#conversationHistoryNext').click();await page.waitForFunction(()=>document.querySelectorAll('#messages li').length===2);assert.equal(await page.locator('#messages').textContent().then(s=>s.includes('History 21')),true);await page.locator('#conversationReload').click();await page.waitForFunction(()=>document.querySelectorAll('#messages li').length===20);assert.equal(await page.locator('#messageDraft').inputValue(),'');
 for(const language of ['gu','hi','en']){await page.locator('#localeSelect').selectOption(language);await page.waitForFunction(code=>document.documentElement.lang===code,language);assert.equal(await page.locator('#messages').textContent().then(s=>s.includes('મૂળ જવાબ हिन्दी')),true);}
 await page.locator('#inboxLink').click();await page.waitForURL('**/service-inbox-preview.html#inbox/**');await inbox('provider');assert.equal(await page.locator('#detailReply').textContent(),'History 21');await page.goBack();await page.waitForURL('**/service-conversation-preview.html#conversation/provider/**');await conversation('provider');
 await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.evaluate(()=>binding.setSession(null));assert.equal(await page.locator('#messages').textContent(),'');assert.equal(await page.locator('#messageDraft').inputValue(),'');f.uid('foreign');await conversation('provider');assert.equal(await page.locator('#messages').textContent(),'');assert.equal(await page.locator('#conversationUnavailable').isVisible(),true);assert.deepEqual(remote,[]);
 }finally{await context.close();}
});

for(const locale of ['gu','hi','en'])test('Provider privacy controls use scoped Auth, retry and restore history '+locale,async()=>{
 const context=await browser.newContext({viewport:{width:locale==='gu'?320:375,height:850}});
 try{
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(origin+'/service-conversation-preview.html#conversation/buyer/provider/enquiry');
  await page.evaluate(async locale=>{
   const {mountProviderConversation}=await import('/features/service-providers/private-conversation-dom.mjs');
   const {createFirebaseMarketplaceIntegration}=await import('/features/marketplace/firebase-integration.mjs');
   const catalog=await (await import('/features/i18n/i18n.mjs')).loadTranslator(locale);
   const user={uid:'buyer',getIdToken:async()=> 'buyer.fixture.token'};
   let observe,session,hidden=false,blocked=false;
   const auth={app:{options:{projectId:'oldx-staging'}},currentUser:user,onIdTokenChanged(fn){observe=fn;return ()=>{};}};
   window.hideCalls=[];window.blockCalls=[];window.invalidationEvents=0;
   document.addEventListener('oldx:chat-read-state-changed',()=>invalidationEvents++);
   const bridge=createFirebaseMarketplaceIntegration({enabled:true,auth,makeSessionId:()=> 'scope',
    onSession:value=>session=value,providerVisibilityEnabled:true,providerBlockEnabled:true,providerReadStateEnabled:true,
    providerReconciledHistoryEnabled:true,sendProviderConversation:async(op,body,{credential})=>{
     if(credential!=='buyer.fixture.token')throw Error('Missing scoped credential');
     if(op==='blockState')return {status:200,body:{ok:true,blocked,revision:1}};
     if(op==='changeBlock'){
      blockCalls.push(body);blocked=body.blocked;
      if(blockCalls.length===1)throw Error('Lost block acknowledgement');
      return {status:200,body:{ok:true,status:blockCalls.length===2?'replayed':'changed'}};
     }
     if(op==='read'&&blocked)return {status:403,body:{ok:false,error:{code:'DENIED'}}};
     if(op==='read')return {status:200,body:{ok:true,
      thread:{providerId:'provider',enquiryId:'enquiry',service:'Repair',revision:1,enquiryRevision:0,generation:1,role:'buyer',canSend:true},
      messages:hidden?[]:[{sequence:1,role:'provider',text:'ખાનગી संदेश'}],
      throughSequence:1,hasMore:false,readReceipt:'signed'}};
     if(op==='acknowledge')return {status:200,body:{ok:true,status:'unchanged',readSequence:1}};
     hideCalls.push(body);
     if(hideCalls.length===1){hidden=true;throw Error('Lost acknowledgement');}
     return {status:200,body:{ok:true,status:'replayed'}};
    }});
   window.binding=mountProviderConversation({enabled:true,translate:key=>catalog.t(key),messaging:bridge.providerMessaging});
   observe(user);await binding.setSession(session);
   window.logoutFixture=()=>{auth.currentUser=null;observe(null);return binding.setSession(session);};
  },locale);
  const label=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default['market.provider.hideMessage'];
  await page.getByRole('button',{name:label}).click();
  await page.waitForFunction(()=>binding.model.snapshot().canRetry);
  assert.equal(await page.locator('#messages').textContent(),'');
  await page.locator('#conversationRetryCommand').click();
  await page.waitForFunction(()=>hideCalls.length===2&&binding.model.snapshot().status==='ready');
  const calls=await page.evaluate(()=>hideCalls);
  assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].action,'hide_for_self');
  assert.equal(Object.hasOwn(calls[0],'uid'),false);
  assert.equal(await page.locator('#messages li').count(),0);
  assert.ok(await page.evaluate(()=>invalidationEvents>0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
  const block=page.getByRole('button',{name:catalog['market.provider.block'],exact:true});
  const unblock=page.getByRole('button',{name:catalog['market.provider.unblock'],exact:true});
  await block.click();
  await page.waitForFunction(()=>binding.model.snapshot().canRetry);
  assert.equal(await unblock.count(),0);
  assert.equal(await page.locator('#draftForm').isVisible(),false);
  await page.locator('#conversationRetryCommand').click();
  await unblock.waitFor();
  await unblock.click();
  await block.waitFor();
  await page.waitForFunction(()=>binding.model.snapshot().status==='ready');
  const mutations=await page.evaluate(()=>blockCalls);
  assert.deepEqual(mutations[0],mutations[1]);
  assert.deepEqual(mutations.map(({expectedBlocked,blocked})=>[expectedBlocked,blocked]),[[false,true],[false,true],[true,false]]);
  assert.equal(await page.locator('#messages li').count(),0);
  await page.evaluate(()=>logoutFixture());
  assert.equal(await block.count(),0);
  assert.equal(await page.locator('#messages').textContent(),'');
 }finally{await context.close();}
});
