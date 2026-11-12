import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright-core';import {startPreviewServer} from './preview-server.mjs';
let server,browser,origin;const source=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const homepageFirebaseFixture = `
 const account = {currentUser:null, setPersistence:async()=>{}, onAuthStateChanged(callback){
  window.setFixtureAccount = user => { this.currentUser=user; callback(user); };
  document.addEventListener('DOMContentLoaded',()=>window.setFixtureAccount(null),{once:true});
 }};
 const empty={docs:[],empty:true,metadata:{fromCache:false,hasPendingWrites:false}};
 const query={where:()=>query,orderBy:()=>query,limit:()=>query,startAfter:()=>query,
  collection:()=>query,doc:()=>query,get:async()=>empty,set:async()=>{},onSnapshot:()=>()=>{}};
 window.firebase={apps:[],initializeApp(){},auth:Object.assign(()=>account,{Auth:{Persistence:{LOCAL:'local'}}}),
  firestore:Object.assign(()=>query,{FieldPath:{documentId:()=> '__name__'},FieldValue:{serverTimestamp:()=>null}}),
  storage:()=>({})};
`;

async function fullHomepage(){
 const context=await browser.newContext({viewport:{width:320,height:850}});
 const intercepted=[],errors=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.href===origin+'/homepage-fixture')return route.fulfill({contentType:'text/html',body:source});
  if(url.origin===origin&&url.pathname.startsWith('/features/'))return route.continue();
  if(url.origin===origin)return route.fulfill({status:404});
  intercepted.push(url.href);
  if(url.hostname==='cdn.tailwindcss.com'&&url.pathname==='/')return route.fulfill({contentType:'text/javascript',
   body:process.env.OLDX_TEST_TAILWIND_FILE?await readFile(process.env.OLDX_TEST_TAILWIND_FILE,'utf8'):'window.tailwind={}'});
  if(url.pathname.endsWith('/firebase-app-compat.js'))return route.fulfill({contentType:'text/javascript',body:homepageFirebaseFixture});
  if(url.hostname==='api.ipify.org')return route.fulfill({contentType:'application/json',body:'{"ip":"synthetic"}'});
  return route.fulfill({contentType:'text/plain',body:''});
 });
 const page=await context.newPage();
 page.setDefaultTimeout(5000);
 page.on('pageerror',error=>errors.push(error.message));
 return {context,page,intercepted,errors};
}

test('real Product Chat keeps delayed sends and drafts scoped to the active conversation and account',async()=>{
 const {context,page,errors}=await fullHomepage();
 try{
  const composer=page.locator('#fullChatInput'),chat=page.locator('#fullChatPage');
  for(const [width,locale] of [[320,'gu'],[375,'hi'],[375,'en']]){
   await page.setViewportSize({width,height:850});
   await page.goto(origin+'/homepage-fixture');
   await page.locator('#marketplaceLocale').selectOption(locale);
   await page.waitForFunction(code=>document.documentElement.lang===code,locale);
   await page.evaluate(()=>{
    setFixtureAccount({uid:'fixture-buyer'});
    window.fixtureSends=[];
    const collection=db.collection;
    db.collection=name=>{
     if(name==='users')return {...collection(name),doc:uid=>({...collection(name).doc(uid),
      get:()=>uid==='fixture-seller-a'
       ?new Promise(resolve=>{window.finishPermission=()=>resolve({exists:false});})
       :Promise.resolve({exists:false})})};
     if(name==='chats')return {...collection(name),doc:room=>({...collection(name).doc(room),
      collection:child=>({...collection(name).doc(room).collection(child),
       add:async message=>fixtureSends.push({room,text:message.text,sender:message.senderUid})})})};
     return collection(name);
    };
    readLegacyInboxSummaries=async()=>[{chat:{chatRoomId:'fixture-room-a',participants:['fixture-buyer','fixture-seller-a']},unreadCount:0}];
    window.finishPermission=null;
    window.openFixtureProduct=()=>{
     currentProduct={docId:'fixture-product-b',sellerUid:'fixture-seller-b',title:'Seller ગુજરાતી हिन्दी',desc:'',images:[]};
     renderProductDetailView(currentProduct);
     document.getElementById('homeView').style.display='none';
     document.getElementById('productDetailView').style.display='block';
    };
   });
   await page.locator('[onclick="openInboxModal()"]').click();
   await page.locator('#inboxConversationsList').getByText('Chat Room').click();
   await page.evaluate(()=>{
    const originalReader=window.FileReader;
    window.FileReader=class {
     readAsDataURL(){
      window.FileReader=originalReader;
      window.finishAttachment=()=>this.onload({target:{result:'data:image/png;base64,AA=='}});
     }
    };
   });
   await page.locator('#chatFileInput').setInputFiles({
    name:'fixture.png',mimeType:'image/png',buffer:Buffer.from([0]),
   });
   await composer.fill('Room A ગુજરાતી हिन्दी');
   await page.locator('#chatSendButton').click();
   await page.waitForFunction(()=>typeof window.finishPermission==='function');
   await chat.getByRole('button',{name:(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default['market.product.chatBack']}).click();
   await page.waitForFunction(()=>location.hash!=='#chat');
   await page.evaluate(()=>openFixtureProduct());
   await page.locator('[onclick="openLiveChatModal()"]').click();
   await composer.fill('Room B ગુજરાતી हिन्दी');
   await page.evaluate(async()=>{finishAttachment();finishPermission();await Promise.resolve();});
   assert.deepEqual(await page.evaluate(()=>fixtureSends),[]);
   assert.equal(await composer.inputValue(),'Room B ગુજરાતી हिन्दी');
   assert.equal(await page.locator('#chatAttachmentName').textContent(),'');
   await page.locator('#chatSendButton').click();
   await page.waitForFunction(()=>fixtureSends.length===1);
   assert.deepEqual(await page.evaluate(()=>fixtureSends),[
    {room:'fixture-product-b_fixture-buyer',text:'Room B ગુજરાતી हिन्दी',sender:'fixture-buyer'},
   ]);
   await composer.fill('Prior account draft');
   await page.evaluate(()=>{
    document.getElementById('fullChatMessages').textContent='Prior account message';
    setFixtureAccount({uid:'fixture-other'});
   });
   assert.equal(await chat.isVisible(),false);
   assert.equal(await composer.inputValue(),'');
   assert.equal(await page.locator('#fullChatMessages').textContent(),'');
   assert.equal(await page.locator('#inboxConversationsList').textContent(),'');
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('full homepage gives location and search controls keyboard access and mobile touch targets',async()=>{
 const {context,page,errors}=await fullHomepage();
 try{
  await page.goto(origin+'/homepage-fixture');
  const state=page.locator('#selectedStateText').locator('../..');
  const distance=page.locator('#selectedDistanceText').locator('..');
  for(const width of [320,375,768,1280]){
   await page.setViewportSize({width,height:850});
   const locale=width===320?'gu':width===375?'hi':'en';
   await page.locator('#marketplaceLocale').selectOption(locale);
   await page.waitForFunction(code=>document.documentElement.lang===code,locale);
   for(const [button,modal] of [[state,'#customStateModal'],[distance,'#customDistanceModal']]){
    assert.equal(await button.evaluate(node=>node.tagName),'BUTTON');
    await button.press('Enter');
    assert.equal(await page.locator(modal).isVisible(),true);
    await page.locator(modal).evaluate(node=>node.style.display='none');
    assert.ok((await button.boundingBox()).height>=44);
   }
   assert.ok((await page.locator('[data-i18n-aria-label="market.home.voice"]').boundingBox()).height>=44);
   assert.equal(await page.locator('#oldxMobileNav').isVisible(),width<768);
   if(process.env.OLDX_TEST_TAILWIND_FILE)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  }
  await page.setViewportSize({width:375,height:850});
  await page.locator('#oldxMobileNav [data-i18n="market.nav.search"]').click();
  await page.waitForFunction(()=>location.hash==='#search'&&document.activeElement.id==='searchInput');
  await page.locator('#oldxMobileNav [data-i18n="market.nav.sell"]').click();
  assert.equal(await page.locator('#authModal').isVisible(),true);
  await page.locator('#authModal').evaluate(node=>node.style.display='none');
  await page.evaluate(()=>setFixtureAccount({uid:'fixture-owner',email:'owner@example.invalid'}));
  assert.equal(await page.locator('#authContainer [data-i18n]').getAttribute('data-i18n'),'market.home.logout');
  await page.evaluate(()=>setFixtureAccount(null));
  assert.equal(await page.locator('#authContainer [data-i18n]').getAttribute('data-i18n'),'market.home.login');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('real Product Chat and Inbox expose localized mobile controls and keyboard focus',async()=>{
 const {context,page,errors}=await fullHomepage();
 try{
  await page.goto(origin+'/homepage-fixture');
  const chat=page.locator('#fullChatPage'),inbox=page.locator('#inboxModal');
  const draft=page.locator('#fullChatInput');
  const authored='મારો સંદેશ मेरा संदेश';
  const controls=page.locator('[data-chat-touch]');
  for(const width of [320,375]){
   await page.setViewportSize({width,height:850});
   for(const locale of ['gu','hi','en']){
    await page.locator('#marketplaceLocale').selectOption(locale);
    await page.waitForFunction(code=>document.documentElement.lang===code,locale);
    const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
    assert.equal(await controls.count(),7);
    for(const control of await controls.all()){
     const key=await control.getAttribute('data-i18n-aria-label');
     assert.ok(catalog[key],key);
     assert.equal(await control.getAttribute('aria-label'),catalog[key]);
     assert.deepEqual(await control.evaluate(node=>{
      const style=getComputedStyle(node);
      return [style.minWidth,style.minHeight];
     }),['44px','44px']);
    }
    await inbox.evaluate(node=>node.style.display='flex');
    const close=inbox.locator('[data-chat-touch]');
    assert.ok((await close.boundingBox()).height>=44);
    await close.press('Enter');
    assert.equal(await inbox.isVisible(),false);
    await chat.evaluate(node=>node.style.display='flex');
    await chat.evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished)));
    assert.equal(await draft.getAttribute('aria-label'),catalog['market.provider.messageDraft']);
    assert.equal(await draft.getAttribute('placeholder'),catalog['market.provider.messageDraft']);
    assert.ok((await draft.boundingBox()).height>=44);
    if(width===320&&locale==='gu')await draft.fill(authored);
    assert.equal(await draft.inputValue(),authored);
    await draft.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'chatSendButton');
    assert.equal(await page.locator('#chatSendButton').evaluate(node=>getComputedStyle(node).outlineWidth),'2px');
    if(process.env.OLDX_TEST_TAILWIND_FILE){
     for(const control of await chat.locator('[data-chat-touch]:visible').all()){
      const box=await control.boundingBox();
      const key=await control.getAttribute('data-i18n-aria-label');
      assert.ok(box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=width,
       `${key} at ${width}px/${locale}: ${JSON.stringify(box)}`);
     }
    }
    await chat.evaluate(node=>node.style.display='none');
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('full homepage starts without requesting the unused Firebase Storage SDK',async()=>{
 const {context,page,intercepted,errors}=await fullHomepage();
 try{
  await page.goto(origin+'/homepage-fixture');
  await page.waitForSelector('#homeCatGrid button');
  assert.ok(intercepted.some(url=>url.endsWith('/firebase-firestore-compat.js')));
  assert.equal(intercepted.filter(url=>url.endsWith('/firebase-storage-compat.js')).length,0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('real Product and Store layouts keep controls usable and long seller text intact',async()=>{
 const {context,page,errors}=await fullHomepage();
 const authored='વેચનારहिन्दीSeller'.repeat(20);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aau8AAAAASUVORK5CYII=';
 try{
  await page.goto(origin+'/homepage-fixture');
  await page.evaluate(({authored,image})=>{
   currentProduct={docId:'sample',title:authored,desc:authored,location:authored,finalPriceStr:'₹12,345',images:[image]};
   renderProductDetailView(currentProduct);
   document.getElementById('productGrid').replaceChildren(createProductCard({...currentProduct,images:['data:image/png;base64,AAAA']}));
   renderStorePublicContent({uid:'sample-store',shopName:authored,address:authored,categories:['cars'],photoURL:'data:image/png;base64,AAAA'},false);
  },{authored,image});
  const detail=page.locator('#productDetailView'),store=page.locator('#storePublicWrap'),gallery=page.locator('#detailImgBadge');
  const show=async id=>page.evaluate(id=>{
   for(const key of ['homeView','productDetailView','storePage','storePublicWrap'])document.getElementById(key).style.display=
    key===id||id==='storePublicWrap'&&key==='storePage'?'block':'none';
  },id);
  await page.locator('#productGrid [data-image-placeholder]').waitFor({state:'attached'});
  assert.equal(await page.locator('#productGrid [data-save-button]').getAttribute('aria-pressed'),'false');
  assert.ok((await page.locator('#productGrid [data-save-button]').boundingBox()).height>=44);
  await page.locator('#storePublicWrap img').waitFor({state:'detached'});
  for(const width of [320,375,768,1280]){
   await page.setViewportSize({width,height:850});
   for(const locale of ['gu','hi','en']){
    await page.locator('#marketplaceLocale').selectOption(locale);
    await page.waitForFunction(code=>document.documentElement.lang===code,locale);
    const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
    await show('productDetailView');
    assert.equal(await detail.locator('#detailTitle').textContent(),authored);
    assert.doesNotMatch(await detail.textContent(),/Verified Seller|Active buyers viewing/);
    assert.equal(await gallery.getAttribute('aria-label'),catalog['market.listing.photos']);
    assert.ok((await gallery.boundingBox()).height>=44);
    if(process.env.OLDX_TEST_TAILWIND_FILE)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Product ${width} ${locale}`);
    await show('storePublicWrap');
    assert.equal(await store.locator('h2').textContent(),authored);
    assert.ok((await store.locator('#storeProductSort').boundingBox()).height>=44);
    if(process.env.OLDX_TEST_TAILWIND_FILE)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Store ${width} ${locale}`);
   }
  }
  await show('productDetailView');
  await gallery.press('Enter');
  assert.equal(await page.locator('#imageLightboxModal').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
before(async()=>{server=await startPreviewServer([]);origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function fixture(){const context=await browser.newContext({viewport:{width:320,height:900}});const remote=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}if(route.request().url()===origin+'/fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});return route.continue();});const page=await context.newPage();await page.goto(origin+'/fixture');const panel=source.slice(source.indexOf('<div class="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"'),source.indexOf('</div>',source.indexOf('id="marketplaceLocaleStatus"'))+6);const controls=[...source.matchAll(/<label for="(?:login|signup)[^"]+"[^>]*>[^<]*<\/label>|<input[^>]+id="(?:searchInput|loginEmail|loginPassword|signupEmail|signupPassword|signupConfirmPassword)"[^>]*>/g)].map(m=>m[0]).join('');await page.setContent('<style>*{box-sizing:border-box}body{margin:12px}input,select{max-width:100%;min-height:44px}label,span{overflow-wrap:anywhere}label,input{display:block}span{display:block}</style>'+panel+controls+'<p id="authored">ગુજરાતી नमूना seller text</p><script type="module" src="/features/i18n/marketplace.mjs"></script>');await page.waitForFunction(()=>document.querySelector('#marketplaceLocale').getAttribute('aria-busy')===null&&document.documentElement.lang==='en');return {context,page,remote};}
test('actual essential-control markup localizes gu/hi/en without altering credentials, seller text or keyboard focus',async()=>{const {context,page,remote}=await fixture();try{await page.locator('#loginPassword').fill('  preserve spaces  ');await page.locator('#searchInput').fill('ખાનગી search');for(const locale of ['gu','hi','en']){await page.locator('#marketplaceLocale').focus();await page.locator('#marketplaceLocale').selectOption(locale);await page.waitForFunction(code=>document.documentElement.lang===code,locale);const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;assert.equal(await page.locator('label[for="loginEmail"]').textContent(),catalog['market.email']);assert.equal(await page.locator('#searchInput').getAttribute('aria-label'),catalog['market.search']);assert.equal(await page.locator('#loginPassword').inputValue(),'  preserve spaces  ');assert.equal(await page.locator('#authored').textContent(),'ગુજરાતી नमूना seller text');assert.equal(await page.locator('#marketplaceLocale').evaluate(n=>document.activeElement===n),true);await page.evaluate(()=>document.body.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}assert.deepEqual(remote,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['oldx.preview.locale.v1']);}finally{await context.close();}});
test('rebound locale control ignores stale catalog completion and survives unavailable preference storage',async()=>{const {context,page}=await fixture();try{await page.evaluate(async()=>{const {mountMarketplaceLocale}=await import('/features/i18n/marketplace.mjs');const {loadTranslator}=await import('/features/i18n/i18n.mjs');window.binding=mountMarketplaceLocale({storage:{getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}},load:code=>code==='gu'?new Promise(r=>window.releaseCatalog=r):loadTranslator(code)});await binding.ready;window.slow=binding.change('gu',true);await binding.change('hi',true);releaseCatalog(await loadTranslator('gu'));await slow;});assert.equal(await page.locator('html').getAttribute('lang'),'hi');assert.equal(await page.locator('#marketplaceLocale').getAttribute('aria-busy'),null);}finally{await context.close();}});

test('dynamic first-party Chat states translate in gu/hi/en without translating authored messages',async()=>{const {context,page}=await fixture();try{for(const locale of ['gu','hi','en']){await page.locator('#marketplaceLocale').selectOption(locale);await page.waitForFunction(code=>document.documentElement.lang===code,locale);await page.evaluate(()=>{document.querySelector('#chat-test')?.remove();const holder=document.createElement('div');holder.id='chat-test';const message=document.createElement('p');message.textContent='Authored ગુજરાતી हिन्दी';const empty=document.createElement('p');empty.dataset.i18n='market.chatEmpty';const button=document.createElement('button');button.textContent='⋯';button.dataset.i18nAriaLabel='market.chatOptions';holder.append(message,empty,button);document.body.append(holder);empty.dispatchEvent(new Event('oldx:translate-ui',{bubbles:true}));button.dispatchEvent(new Event('oldx:translate-ui',{bubbles:true}));});const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;assert.equal(await page.locator('#chat-test p').nth(1).textContent(),catalog['market.chatEmpty']);assert.equal(await page.locator('#chat-test button').getAttribute('aria-label'),catalog['market.chatOptions']);assert.equal(await page.locator('#chat-test p').first().textContent(),'Authored ગુજરાતી हिन्दी');}}finally{await context.close();}});

test('processed WebP fixture decodes in a narrow Chromium viewport without server/native code in browser',async()=>{const {context,page}=await fixture();try{const {default:sharp}=await import('sharp'),{createTrustedImageProcessor}=await import('../../scripts/trusted-image-processor.mjs');const input=await sharp({create:{width:32,height:24,channels:4,background:{r:0,g:120,b:120,alpha:.5}}}).png().toBuffer(),result=await createTrustedImageProcessor({enabled:true,mode:'isolated-test'}).process(input,{surface:'store'});assert.equal(result.ok,true);await page.evaluate(data=>{const image=document.createElement('img');image.id='processed';image.alt='Synthetic fixture';image.style.maxWidth='100%';image.src=data;document.body.append(image);},'data:image/webp;base64,'+Buffer.from(result.bytes).toString('base64'));await page.waitForFunction(()=>document.querySelector('#processed').complete&&document.querySelector('#processed').naturalWidth===32);assert.equal(await page.locator('#processed').evaluate(n=>n.naturalHeight),24);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}finally{await context.close();}});

test('Product publication errors use real locale binding at 320/375px without leaking SDK messages',async()=>{
 const {context,page,remote}=await fixture();try{
  const code=source.slice(source.indexOf('function productPublishErrorKey('),source.indexOf('function closeSuccessModalAndGoHome()'));
  await page.evaluate(()=>{
   for(const id of ['adTitle','adDesc','adPrice','adMrpPrice','adDiscount','adPhone','adState','adDistrict','adVillage']){const n=document.createElement('input');n.id=id;n.value=id==='adTitle'?'મૂળ Cafe\u0301 हिन्दी':'100';document.body.append(n);}
   for(const id of ['adSubmitBtn','adIsFeatured','adIsShopVerified','successAdModal','customAlertTitle','customAlertDesc']){const n=document.createElement('div');n.id=id;document.body.append(n);}
   const photo=document.createElement('input');photo.id='adImages';photo.type='file';document.body.append(photo);
   window.currentUser={uid:'sample-owner'};window.selectedMainCat={id:'mobiles'};window.selectedSubCat='Mobile Phones';window.selectedCoords=null;
   window.firebase={firestore:{FieldValue:{serverTimestamp:()=>null}}};window.fetch=async()=>({json:async()=>({ip:'sample'})});window.compressImage=async()=> 'data:image/jpeg;base64,c2FtcGxl';
   window.db={collection:()=>({add:async()=>{throw {code:'permission-denied',message:'private-token-DO-NOT-DISPLAY'};}})};
   window.showCustomAlert=(title,message)=>{document.getElementById('customAlertTitle').innerText=title;document.getElementById('customAlertDesc').innerText=message;};
  });
  await page.addScriptTag({content:code});
  for(const locale of ['gu','hi','en']){
   await page.setViewportSize({width:locale==='gu'?320:375,height:900});await page.locator('#marketplaceLocale').selectOption(locale);await page.waitForFunction(code=>document.documentElement.lang===code,locale);
   await page.evaluate(()=>handleFinalAdSubmit({preventDefault(){}}));const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
   assert.equal(await page.locator('#customAlertDesc').textContent(),catalog['market.publishDenied']);assert.equal(await page.locator('#adTitle').inputValue(),'મૂળ Cafe\u0301 हिन्दी');assert.equal(await page.locator('#adSubmitBtn').evaluate(n=>n.disabled),false);assert.equal((await page.locator('body').textContent()).includes('private-token-DO-NOT-DISPLAY'),false);
   await page.evaluate(()=>document.body.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  }
  await page.evaluate(()=>{
   window.db.collection=()=>({add:()=>new Promise((resolve,reject)=>window.finishLookup=()=>reject({code:'permission-denied'}))});
   window.pendingPost=handleFinalAdSubmit({preventDefault(){}});
  });
  assert.equal(await page.locator('#adSubmitBtn').textContent(),(await import('../../features/i18n/catalogs/en.mjs')).default['market.legacyPublishing']);
  await page.locator('#marketplaceLocale').selectOption('gu');await page.waitForFunction(()=>document.documentElement.lang==='gu');
  assert.equal(await page.locator('#adSubmitBtn').textContent(),(await import('../../features/i18n/catalogs/gu.mjs')).default['market.legacyPublishing']);
  await page.evaluate(async()=>{finishLookup();await pendingPost;});
  assert.equal(await page.locator('#adSubmitBtn').textContent(),(await import('../../features/i18n/catalogs/gu.mjs')).default['market.legacyPublish']);
  await page.evaluate(async()=>{
   window.crossSessionWrites=0;
   window.db.collection=()=>({add:async()=>{crossSessionWrites++;}});
   const title=document.getElementById('adTitle');const original=title.value;Object.defineProperty(title,'value',{get(){window.currentUser={uid:'replacement'};return original;},configurable:true});
   await handleFinalAdSubmit({preventDefault(){}});
  });
  assert.equal(await page.evaluate(()=>crossSessionWrites),0);
  assert.equal(await page.locator('#adSubmitBtn').evaluate(n=>n.disabled),false);
  assert.deepEqual(remote,[]);
 }finally{await context.close();}
});

test('approved navy/orange header uses native home navigation and wraps touch controls on mobile',async()=>{
 const {context,page,remote}=await fixture();try{
  const style=source.slice(source.indexOf('<style>')+7,source.indexOf('</style>'));
  const start=source.indexOf('<header id="marketplaceHeader"'),header=source.slice(start,source.indexOf('</header>',start)+9);
  assert.ok(start>0);assert.match(source,/primary: '#102a43'/);assert.match(source,/brand: '#f97316'/);
  await page.setContent('<style>'+style+'</style>'+header+'<p id="sellerDraft">મૂળ Cafe\u0301 हिन्दी</p>');
  for(const width of [320,375]){
   await page.setViewportSize({width,height:900});
   for(const font of ['100%','200%']){
    await page.evaluate(font=>{document.documentElement.style.fontSize=font;document.getElementById('storeHeaderBtn').textContent='સ્ટોર બનાવો · स्टोर बनाएँ';document.getElementById('headerAdminBtn').style.display='inline-flex';},font);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    for(const control of ['#oldxHomeLink','#storeHeaderBtn','#authContainer button'])assert.ok((await page.locator(control).boundingBox()).height>=44);
   }
  }
  await page.locator('#oldxHomeLink').focus();assert.equal(await page.locator('#oldxHomeLink').evaluate(n=>document.activeElement===n&&n.tagName==='A'),true);await page.keyboard.press('Enter');assert.equal(await page.locator('#sellerDraft').textContent(),'મૂળ Cafe\u0301 हिन्दी');assert.deepEqual(remote,[]);
 }finally{await context.close();}
});

test('homepage labels and rerendered controls follow gu/hi/en across refresh',async()=>{
 const {context,page}=await fixture();
 try{
  const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const panel=source.slice(source.indexOf('<div class="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"'),source.indexOf('</div>',source.indexOf('id="marketplaceLocaleStatus"'))+6);
  const header=section('<header id="marketplaceHeader"','<!-- MAIN HOME VIEW -->');
  const home=section('<div id="homeView">','<!-- MODERN STATE PICKER');
  const code=[
   section('function translateHomepageLabels(','function initCustomPickers('),
   section('function renderDistanceList(','let userCategoryViews'),
   section('const olxCategories =','const districtData ='),
   section('function renderHomepageAuth(','auth.onAuthStateChanged('),
   section('function renderHomeCategories(','// Load a small, bounded'),
   section('function refreshStoreHeader(','function handleStoreHeaderClick(')
  ].join('\n');
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>img{max-width:100%;width:48px}*{overflow-wrap:anywhere}'+section('<style>','</style>').slice(7)+'</style></head><body>'+
   panel+header+home+'<div id="distanceListContainer"></div><p id="authored">Seller Gujarati ગુજરાતી · हिन्दी</p>'+
   '<script>let currentFilterCat="all",currentSelectedDistance="all";function closeCustomDistanceModal(){}function renderProducts(){};const db={collection:()=>({doc:()=>({get:()=>new Promise(resolve=>window.finishStore=resolve)})})};'+code+
   'renderHomeCategories();renderDistanceList();</script><script type="module" src="/features/i18n/marketplace.mjs"></script></body></html>';
  await page.route(origin+'/homepage-locale',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  await page.goto(origin+'/homepage-locale');
  for(const locale of ['gu','hi','en']){
   await page.setViewportSize({width:locale==='gu'?320:375,height:850});
   await page.locator('#marketplaceLocale').selectOption(locale);
   await page.waitForFunction(code=>document.documentElement.lang===code&&!document.getElementById('marketplaceLocale').hasAttribute('aria-busy'),locale);
   const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
   const check=async(selector,key)=>assert.equal((await page.locator(selector).textContent()).trim(),catalog[key]);
   for(const key of ['hero','tagline','categories','fresh','services','stores'])await check('[data-i18n="market.home.'+key+'"]','market.home.'+key);
   await check('#authContainer [data-i18n]','market.home.login');
   await check('#storeHeaderBtn [data-i18n]','market.home.createStore');
   assert.equal(await page.locator('[data-i18n-title="market.home.voice"]').getAttribute('title'),catalog['market.home.voice']);
   assert.equal(await page.locator('[data-i18n-title="market.home.voice"]').getAttribute('aria-label'),catalog['market.home.voice']);
   await page.evaluate(()=>{currentFilterCat='cars';renderHomeCategories();document.querySelector('#distanceListContainer [data-i18n="market.home.distance15"]').click();});
   await check('#homeCatGrid [data-i18n="store.category.cars"]','store.category.cars');
   await check('#selectedDistanceText','market.home.distance15');
   await page.evaluate(()=>{window.currentUser={uid:'synthetic-owner'};renderHomepageAuth(currentUser);refreshStoreHeader(currentUser);});
   await check('#authContainer [data-i18n]','market.home.logout');
   await check('#storeHeaderBtn [data-i18n]','market.home.store');
   await page.evaluate(()=>finishStore({exists:true}));
   await page.waitForFunction(()=>document.querySelector('#storeHeaderBtn [data-i18n]').dataset.i18n==='market.home.myStore');
   await check('#storeHeaderBtn [data-i18n]','market.home.myStore');
   await page.evaluate(()=>{refreshStoreHeader(currentUser);window.currentUser=null;renderHomepageAuth(null);refreshStoreHeader(null);finishStore({exists:true});});
   await check('#authContainer [data-i18n]','market.home.login');
   await check('#storeHeaderBtn [data-i18n]','market.home.createStore');
   assert.equal(await page.locator('#authored').textContent(),'Seller Gujarati ગુજરાતી · हिन्दी');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.reload();
   await page.waitForFunction(code=>document.documentElement.lang===code&&!document.getElementById('marketplaceLocale').hasAttribute('aria-busy'),locale);
   await check('[data-i18n="market.home.hero"]','market.home.hero');
   await check('#selectedDistanceText','market.home.distanceAll');
  }
 }finally{await context.close();}
});

test('homepage mobile navigation, category keyboard focus and Product card layout use real markup',async()=>{
 const {context,page,remote}=await fixture();
 try{
  const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const style=section('<style>','</style>').slice(7);
  const nav=section('<nav id="oldxMobileNav"','</nav>')+'</nav>';
  const search=source.match(/<input[^>]+id="searchInput"[^>]+>/)[0];
  const code=[
   section('function translateHomepageLabels(','function initCustomPickers('),
   section('const olxCategories =','const districtData ='),
   section('function renderHomeCategories(','// Load a small, bounded'),
   section('function filterCat(','function legacyReadCopy('),
   section('function openHomepageSearch(','// STORE FEATURE FUNCTIONS'),
   section('function createProductCard(','return card;')+'return card; }'
  ].join('\n');
  await page.evaluate(({style,nav,search})=>{
   document.head.insertAdjacentHTML('beforeend','<style>'+style+'</style>');
   document.body.insertAdjacentHTML('beforeend',nav+'<div id="homeView">'+search+'<div id="homeCatGrid"></div><div id="sampleCard" style="width:150px"></div></div>');
   for(const id of ['storePage','sellWizardPage','profilePage','productSkeletonSlide','productDetailView','fullEditPage']){
    const element=document.createElement('div');element.id=id;document.body.append(element);
   }
  },{style,nav,search});
  await page.addScriptTag({content:`
   let currentFilterCat='all',storePageReadGeneration=0,storeCatalogueGeneration=0,storeCatalogueState=null;
   function renderRecentlyViewed(){} function renderProducts(){} function getSavedAdsStorageKey(){return 'fixture-saved';}
   function startSellWizard(){window.navAction='sell';} function openInboxModal(){window.navAction='chat';}
   function openProfilePage(){window.navAction='profile';} function openProductDetailPage(id){window.navAction=id;}
   `+code+`
   for(const category of olxCategories) category.img='data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';
   renderHomeCategories();
   const card=createProductCard({docId:'fixture-product',title:'Seller Gujarati ગુજરાતી · हिन्दी',
    location:'A long location name in Gujarat for a narrow card',finalPriceStr:'&#8377;12,345'});
   document.getElementById('sampleCard').append(card);
  `});
  const bar=page.locator('#oldxMobileNav');
  for(const locale of ['gu','hi','en']){
   await page.locator('#marketplaceLocale').selectOption(locale);
   await page.waitForFunction(code=>document.documentElement.lang===code,locale);
   const catalog=(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default;
   assert.equal(await bar.getAttribute('aria-label'),catalog['market.nav.label']);
   for(const name of ['home','search','sell','chat','profile']){
    assert.equal(await bar.locator('[data-i18n="market.nav.'+name+'"]').textContent(),catalog['market.nav.'+name]);
   }
   for(const width of [320,375]){
    await page.setViewportSize({width,height:850});
    for(const font of ['100%','200%']){
     await page.evaluate(size=>document.documentElement.style.fontSize=size,font);
     assert.equal(await bar.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
     for(const control of await bar.locator('a,button').all()){
      const box=await control.boundingBox();
      assert.ok(box.width>=44&&box.height>=44);
     }
    }
   }
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');
  await bar.locator('button').first().press('Enter');
  await page.waitForFunction(()=>location.hash==='#search'&&document.activeElement.id==='searchInput');
  assert.equal(await bar.locator('button').first().getAttribute('aria-current'),'page');
  const cars=page.locator('#homeCatGrid button').filter({has:page.locator('[data-i18n="store.category.cars"]')});
  await cars.press('Enter');
  assert.equal(await cars.getAttribute('aria-pressed'),'true');
  assert.equal(await cars.evaluate(n=>n===document.activeElement),true);
  assert.equal(await page.locator('[data-card-price]').textContent(),'₹12,345');
  assert.equal(await page.locator('[data-card-title]').textContent(),'Seller Gujarati ગુજરાતી · हिन्दी');
  assert.match(await page.locator('[data-card-location]').textContent(),/long location name/);
  assert.equal(await page.locator('[data-card-image-area]').evaluate(n=>getComputedStyle(n).aspectRatio),'4 / 3');
  await page.locator('[data-card-title]').press('Enter');
  assert.equal(await page.evaluate(()=>window.navAction),'fixture-product');
  for(const name of ['sell','chat','profile']){
   await bar.locator('button').filter({has:page.locator('[data-i18n="market.nav.'+name+'"]')}).press('Enter');
   assert.equal(await page.evaluate(()=>window.navAction),name);
  }
  await bar.locator('a').press('Enter');
  await page.waitForFunction(()=>location.hash==='');
  await page.goBack();
  await page.waitForFunction(()=>location.hash==='#search'&&document.activeElement.id==='searchInput');
  await page.setViewportSize({width:800,height:850});
  assert.equal(await bar.isVisible(),false);
  assert.deepEqual(remote,[]);
 }finally{await context.close();}
});
