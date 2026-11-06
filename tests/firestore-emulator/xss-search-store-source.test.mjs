import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('Search autocomplete renders product text through textContent and validates image URLs', () => {
  const block = section('function handleSearchInput()', 'document.addEventListener(\'click\', (e) =>');
  assert.match(block, /title\.textContent\s*=\s*String\(m\.title/);
  assert.match(block, /price\.textContent\s*=\s*String\(m\.finalPriceStr/);
  assert.match(block, /\^https\?:/);
  assert.doesNotMatch(block, /\$\{m\.title\}|\$\{m\.finalPriceStr\}|\$\{m\.images/);
});

test('Public Store category filters use data attributes and event listeners', () => {
  const block = section('function renderStorePublicContent(data, isOwner)', 'function filterStoreProducts(categoryId)');
  assert.match(block, /data-store-category/);
  assert.match(block, /addEventListener\('click',[\s\S]*?filterStoreProducts\(button\.getAttribute\('data-store-category'\)\)/);
  assert.doesNotMatch(block, /onclick="filterStoreProducts/);
  assert.doesNotMatch(block, /getAttribute\('onclick'\)/);
  assert.match(source, /function isSafeStoreImageUrl\(value\)/);
  assert.match(block, /isSafeStoreImageUrl\(data\.photoURL\)/);
  assert.match(source, /function getValidStoreCoordinates\(coords\)/);
  assert.match(block, /const storeCoords = getValidStoreCoordinates\(data\.coords\)/);
  assert.doesNotMatch(block, /data\.coords\.(?:lat|lng)/);
});

test('Store catalogue provides accessible search, sorting, counts and share action', () => {
  const block = section('function renderStorePublicContent(data, isOwner)', 'function escapeStoreHtml');
  assert.match(block, /id="storeProductSearch"/);
  assert.match(block, /aria-label="Search products in this shop"/);
  assert.match(block, /id="storeProductSort"/);
  assert.match(block, /price-low/);
  assert.match(block, /available/);
  assert.match(block, /id="storeProductsCount"/);
  assert.match(block, /Share this Shop/);
  assert.match(source, /function filterStoreProducts\(categoryId\)/);
  assert.match(source, /p\.title, p\.description, p\.desc, p\.location, p\.brand/);
  assert.match(source, /Number\(!!a\.isSold\) - Number\(!!b\.isSold\)/);
  assert.match(source, /items\.forEach\(p => \{ if \(typeof createProductCard/);
});

test('Homepage Store discovery uses a bounded public query and safe DOM rendering', () => {
  assert.match(source, /id="homeStoresSection"/);
  assert.match(source, /id="homeStoresGrid"/);
  assert.match(source, /loadHomeStores\(\);/);
  const block = section('async function loadHomeStores()', 'function filterCat(catId)');
  assert.match(block, /collection\('stores'\)\.orderBy\('updatedAt', 'desc'\)\.limit\(6\)\.get\(\)/);
  assert.match(block, /isSafeStoreImageUrl\(data\.photoURL\)/);
  assert.match(block, /name\.textContent\s*=\s*store\.shopName/);
  assert.match(block, /card\.addEventListener\('click'/);
  assert.doesNotMatch(block, /innerHTML\s*=/);
});

test('legacy partial product records cannot crash catalogue/autocomplete search and authored multilingual text is preserved', async () => {
  const {runInNewContext}=await import('node:vm');
  const block=section('function productMatchesSearch(', 'function handleSearchInput()');
  const matches=runInNewContext('('+block.trim()+')');
  for(const row of [null,{}, {title:null,location:4,category:[]}, {title:12}])assert.equal(matches(row,'sample',['title','location']),false);
  const row={title:'ગુજરાતી नमूना SAMPLE',category:'Tools',location:'અમદાવાદ'};
  assert.equal(matches(row,'sample',['title','category']),true);
  assert.equal(matches(row,'नमूना',['title','location']),true);
  assert.equal(matches(row,'અમદાવાદ',['title','location']),true);
  assert.equal(row.title,'ગુજરાતી नमूना SAMPLE');
  assert.match(source,/productMatchesSearch\(p, query, \['title', 'category'\]\)/);
  assert.match(source,/productMatchesSearch\(p, searchVal, \['title', 'location'\]\)/);
});

test('legacy Login and Signup preserve password bytes and credential failures do not distinguish registered accounts',async()=>{
 const {runInNewContext}=await import('node:vm');const values={loginEmail:{value:' sample@example.invalid '},loginPassword:{value:'  secret sample  '},rememberMeCheckbox:{checked:false},signupEmail:{value:' sample@example.invalid '},signupPassword:{value:'  secret sample  '},signupConfirmPassword:{value:'  secret sample  '}};const captured=[],alerts=[];
 const globals={document:{getElementById:id=>values[id]},firebase:{auth:{Auth:{Persistence:{LOCAL:'local',SESSION:'session'}}}},auth:{setPersistence:()=>Promise.resolve(),signInWithEmailAndPassword:(email,password)=>{captured.push({email,password});return Promise.reject({code:'auth/user-not-found'});},createUserWithEmailAndPassword:(email,password)=>{captured.push({email,password});return Promise.resolve({user:null});}},closeAuthModal(){},showCustomAlert:(...args)=>alerts.push(args)};
 runInNewContext(section('function handleEmailLogin(e)', 'function togglePasswordVisibility(')+';handleEmailLogin({preventDefault(){}});handleEmailSignup({preventDefault(){}});',globals);await new Promise(r=>setImmediate(r));assert.equal(captured.length,2);assert.ok(captured.every(r=>r.password==='  secret sample  '&&r.email==='sample@example.invalid'));assert.ok(alerts.some(r=>r[1]==='Could not sign in. Check your email and password or reset your password.'));
 assert.doesNotMatch(section('function handleEmailLogin(e)', 'function handleEmailSignup(e)'),/email is not registered|Incorrect password/);
});

test('essential locale markers do not relabel listing submit controls or replace authored content',()=>{
 assert.equal((source.match(/data-i18n="market.login"/g)||[]).length,1);
 assert.equal((source.match(/data-i18n="market.signup"/g)||[]).length,1);
 assert.match(source,/src="features\/i18n\/marketplace.mjs"/);
 assert.match(source,/for="loginPassword" data-i18n="market.password"/);
});

test('legacy Chat displays latest 35 records chronologically without mutating the SDK snapshot',async()=>{
 const {runInNewContext}=await import('node:vm');const helper=runInNewContext('('+section('function chronologicalChatDocuments(', 'function loadChatMessages(').trim()+')');const docs=[{id:'newest'},{id:'older'}];assert.deepEqual(Array.from(helper({docs})).map(x=>x.id),['older','newest']);assert.equal(docs[0].id,'newest');assert.equal(helper({}).length,0);const listener=section('function loadChatMessages(', 'async function openChatPrivacyMenu(');assert.match(listener,/orderBy\('createdAt', 'desc'\)\.limit\(35\)/);assert.match(listener,/chronologicalChatDocuments\(snapshot\)\.forEach/);
});

test('actual Chat listener renders descending SDK rows chronologically, not just receipt updates',async()=>{
 const {runInNewContext}=await import('node:vm');let callback;const make=()=>({children:[],dataset:{},appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];},addEventListener(){},setAttribute(){},querySelectorAll(){return [];}}),container=make();const chain={collection(){return this;},doc(){return this;},orderBy(field,direction){assert.equal(field,'createdAt');assert.equal(direction,'desc');return this;},limit(n){assert.equal(n,35);return this;},onSnapshot(fn){callback=fn;return ()=>{};}};
 runInNewContext('let legacyChatGeneration=0,legacyChatState=null,legacyReadReceiptTimer=null,activeChatUnsubscribe=null;'+section('function stopLegacyChatRead()', 'function openMessageActions(')+';loadChatMessages("sample");',{document:{getElementById:()=>container,createElement:make},window:{currentUser:{uid:'buyer'}},db:chain,setTimeout(){},clearTimeout(){},legacyReadCopy:k=>k,activeChatUnsubscribe:null});const docs=[{id:'new',data:()=>({senderUid:'seller',text:'Newest'})},{id:'old',data:()=>({senderUid:'seller',text:'Oldest'})}];callback({empty:false,docs,forEach:fn=>docs.forEach(fn)});assert.equal(container.children[0].children[0].textContent,'Oldest');assert.equal(container.children[1].children[0].textContent,'Newest');assert.equal(docs[0].id,'new');
});
