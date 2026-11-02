import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStorePreviewCard,exportStorePreviewCard,wrapCardText} from './preview-card.mjs';
const valid={store:{id:'demo-shop',name:'કિરણનું ઘર · घर',city:'અમદાવાદ'},category:'Furniture · પુસ્તકો',pageUrl:'https://preview.example/store-preview.html?secret=PRIVATE',origin:'https://preview.example',labels:{badge:'SAMPLE ONLY · NOT LIVE',caption:'Browse sample products'}};
test('sample card preserves multilingual public text and excludes private extras and query state',()=>{
 const result=buildStorePreviewCard({...valid,store:{...valid.store,phone:'PRIVATE',photo:'https://tracker.example/private'}});
 assert.equal(result.ok,true);assert.equal(result.value.name,valid.store.name);
 assert.match(result.value.svg,/<title/);assert.match(result.value.svg,/કિરણનું ઘર/);
 assert.equal(result.value.svg.includes('PRIVATE'),false);
 assert.doesNotMatch(result.value.svg,/<(?:script|image|foreignObject|a)\b|\bonload\s*=|https:\/\/tracker/);
 assert.equal(result.value.url,'https://preview.example/store-preview.html#store/demo-shop');
});
test('long names wrap without truncation or splitting Gujarati/Hindi graphemes',()=>{
 for(const value of ['કિ'.repeat(50),'कि'.repeat(50),'W'.repeat(120)]){
  assert.equal(wrapCardText(value,16).join(''),value);
  assert.equal(buildStorePreviewCard({...valid,store:{...valid.store,name:value}}).ok,true);
 }
 assert.equal(wrapCardText('કિકિ',1).length,2);
 assert.equal(wrapCardText('किकि',1).length,2);
});
test('card rejects missing, unsafe and oversized data; XML metacharacters remain text',()=>{
 for(const patch of [{store:null},{store:{...valid.store,name:''}},{store:{...valid.store,name:'a'.repeat(121)}},{store:{...valid.store,name:'<script>'}},{category:''},{labels:{badge:'x',caption:'\u0000'}}]) assert.equal(buildStorePreviewCard({...valid,...patch}).ok,false);
 const result=buildStorePreviewCard({...valid,store:{...valid.store,name:'Kiran & "Sons"'}});
 assert.match(result.value.svg,/Kiran &amp; &quot;Sons&quot;/);
});
test('SVG export releases object URLs on success and denied download',async()=>{
 for(const fail of [false,true]){
  const revoked=[];let filename;
  const result=await exportStorePreviewCard(valid,{createBlob:(value,type)=>({value,type}),createObjectURL:()=> 'blob:sample',revokeObjectURL:url=>revoked.push(url),download:async(url,name)=>{filename=name;if(fail)throw Error('PRIVATE');}});
  assert.equal(result.ok,!fail);assert.deepEqual(revoked,['blob:sample']);assert.equal(filename,'oldx-sample-store-demo-shop.svg');
 }
 assert.equal((await exportStorePreviewCard(valid,{})).ok,false);
});
test('cancellation while fonts/ready is pending never starts a download',async()=>{
 let release,current=true,downloads=0;
 const task=exportStorePreviewCard(valid,{ready:()=>new Promise(resolve=>{release=resolve;}),createBlob:()=>{},createObjectURL:()=>'',revokeObjectURL:()=>{},download:()=>downloads++},()=>current);
 current=false;release();assert.deepEqual(await task,{ok:false,code:'EXPORT_CANCELLED'});assert.equal(downloads,0);
});
