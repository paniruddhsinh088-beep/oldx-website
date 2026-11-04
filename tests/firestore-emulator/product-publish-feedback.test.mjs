import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const start=source.indexOf('function productPublishErrorKey('),end=source.indexOf('function closeSuccessModalAndGoHome()',start);
const code=source.slice(start,end);
const catalogs=Object.fromEntries(await Promise.all(['en','gu','hi'].map(async locale=>[locale,(await import('../../features/i18n/catalogs/'+locale+'.mjs')).default])));
function fixture({locale='en',error={code:'permission-denied',message:'private credential'},imageError=false}={}){
 const nodes=new Map(),writes=[],warnings=[],alerts=[];
 const values={adTitle:'મૂળ Cafe\u0301 हिन्दी',adDesc:'Authored description',adPrice:'100',adMrpPrice:'120',adDiscount:'0',adPhone:'synthetic',adState:'Gujarat',adDistrict:'Sample',adVillage:'Sample'};
 for(const [id,value] of Object.entries(values))nodes.set(id,{value});
 for(const id of ['adSubmitBtn','adIsFeatured','adIsShopVerified','customAlertTitle','customAlertDesc','successAdModal'])nodes.set(id,{checked:false,disabled:false,style:{},dataset:{},dispatchEvent(){this.textContent=catalogs[locale][this.dataset.i18n];}});
 nodes.set('adImages',{files:[{name:'synthetic.png'}]});
 const context=vm.createContext({Object,Event,TextEncoder,parseFloat,Math,console:{log(){},warn:(...v)=>warnings.push(v)},window:{currentUser:{uid:'sample-owner',displayName:'Sample'}},document:{getElementById:id=>nodes.get(id)||null},selectedMainCat:{id:'mobiles'},selectedSubCat:'Mobile Phones',selectedCoords:null,firebase:{firestore:{FieldValue:{serverTimestamp:()=> 'synthetic-time'}}},fetch:async()=>({json:async()=>({ip:'synthetic-only'})}),compressImage:async()=>{if(imageError)throw Error('private photo failure');return 'data:image/jpeg;base64,c2FtcGxl';},db:{collection:name=>({add:async data=>{writes.push({name,data});if(error)throw error;}})},showCustomAlert:(...v)=>alerts.push(v),openAuthModal(){}});
 vm.runInContext(code,context);
 return {context,nodes,writes,warnings,alerts,submit:()=>context.handleFinalAdSubmit({preventDefault(){}})};
}
test('allowlisted error codes do not echo SDK messages or execute hostile getters',()=>{
 const f=fixture(),key=f.context.productPublishErrorKey;
 for(const [c,suffix] of [['permission-denied','Denied'],['firestore/permission-denied','Denied'],['unauthenticated','AuthRequired'],['invalid-argument','Invalid'],['resource-exhausted','Limit'],['unavailable','Unconfirmed'],['deadline-exceeded','Unconfirmed']])assert.equal(key({code:c,message:'private token'},'write'),'market.publish'+suffix);
 let accessed=0;assert.equal(key(Object.defineProperty({},'code',{get(){accessed++;throw Error('secret');}}),'write'),'market.publishUnconfirmed');assert.equal(accessed,0);assert.equal(key(null,'image'),'market.publishImageFailed');
});
for(const locale of ['gu','hi','en'])test(`denied legacy Product publish preserves photo/form and gives safe ${locale} feedback`,async()=>{
 const f=fixture({locale});await f.submit();
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].name,'products');assert.equal(f.writes[0].data.title,'મૂળ Cafe\u0301 हिन्दी');assert.equal(f.writes[0].data.images.length,1);
 assert.equal(f.nodes.get('customAlertDesc').textContent,catalogs[locale]['market.publishDenied']);assert.equal(f.nodes.get('adTitle').value,'મૂળ Cafe\u0301 हिन्दी');assert.equal(f.nodes.get('adImages').files.length,1);assert.equal(f.nodes.get('adSubmitBtn').disabled,false);assert.notEqual(f.nodes.get('successAdModal').style.display,'flex');
 assert.equal(JSON.stringify([f.warnings,f.alerts]).includes('private credential'),false);assert.equal(f.nodes.get('customAlertDesc').dataset.i18n,undefined);
});
test('photo decode failures never write; ambiguous write outcomes never automatically retry',async()=>{
 const photo=fixture({imageError:true});await photo.submit();assert.equal(photo.writes.length,0);assert.equal(photo.nodes.get('customAlertDesc').textContent,catalogs.en['market.publishImageFailed']);
 const unknown=fixture({error:{code:'unavailable',message:'sensitive payload'}});await unknown.submit();assert.equal(unknown.writes.length,1);assert.equal(unknown.nodes.get('customAlertDesc').textContent,catalogs.en['market.publishUnconfirmed']);assert.equal(unknown.nodes.get('adImages').files.length,1);
});
test('success still requires acknowledged Firestore write and existing login guard prevents unauthenticated submission',async()=>{
 const f=fixture({error:null});await f.submit();assert.equal(f.writes.length,1);assert.equal(f.nodes.get('successAdModal').style.display,'flex');assert.equal(f.alerts.length,0);
 const guest=fixture();guest.context.window.currentUser=null;await guest.submit();assert.equal(guest.writes.length,0);assert.equal(guest.alerts[0][0],'Login Required');
});

test('UTF-8 write budget rejects oversized photos/metadata before Firestore and preserves selection',async()=>{
 const f=fixture({error:null});
 f.context.compressImage=async()=> 'data:image/jpeg;base64,'+'A'.repeat(1100000);
 await f.submit();assert.equal(f.writes.length,0);assert.equal(f.nodes.get('customAlertDesc').textContent,catalogs.en['market.publishInvalid']);assert.equal(f.nodes.get('adImages').files.length,1);assert.equal(f.nodes.get('adTitle').value,'મૂળ Cafe\u0301 हिन्दी');assert.equal(f.nodes.get('adSubmitBtn').disabled,false);
 const fits=f.context.legacyProductFitsWriteBudget;
 assert.equal(fits({images:['data:image/jpeg;base64,c2FtcGxl']}),true);
 assert.equal(fits({description:'અ'.repeat(310000)}),false);
 const cyclic={};cyclic.self=cyclic;assert.equal(fits(cyclic),false);
});

test('logout/account replacement during awaited work never posts the old draft under a new session',async()=>{
 for(const phase of ['network','photo'])for(const next of [null,{uid:'other'},{uid:'sample-owner'}]){
  const f=fixture({error:null});
  if(phase==='network')f.context.fetch=async()=>{f.context.window.currentUser=next;return {json:async()=>({ip:'sample'})};};
  else f.context.compressImage=async()=>{f.context.window.currentUser=next;return 'data:image/jpeg;base64,c2FtcGxl';};
  await f.submit();assert.equal(f.writes.length,0);assert.equal(f.alerts.length,0);assert.notEqual(f.nodes.get('successAdModal').style.display,'flex');assert.equal(f.nodes.get('adSubmitBtn').disabled,false);assert.equal(f.nodes.get('adImages').files.length,1);
 }
});
test('late acknowledged/failed writes cannot show prior-session success or errors',async()=>{
 for(const denied of [false,true]){
  const f=fixture({error:null});f.context.db.collection=()=>({add:async data=>{f.writes.push({data});f.context.window.currentUser={uid:'other'};if(denied)throw {code:'permission-denied'};}});
  await f.submit();assert.equal(f.writes.length,1);assert.equal(f.writes[0].data.sellerUid,'sample-owner');assert.equal(f.alerts.length,0);assert.equal(f.warnings.length,0);assert.notEqual(f.nodes.get('successAdModal').style.display,'flex');assert.equal(f.nodes.get('adSubmitBtn').disabled,false);
 }
});
test('duplicate submit while pending does not issue a second legacy add',async()=>{
 const f=fixture({error:null});let release;
 f.context.fetch=()=>new Promise(resolve=>release=()=>resolve({json:async()=>({ip:'sample'})}));
 const first=f.submit();await f.submit();release();await first;assert.equal(f.writes.length,1);assert.equal(f.nodes.get('adSubmitBtn').disabled,false);
});

function editFixture(){
 const f=fixture({error:null});const values={editDocId:'edit-1',editTitle:'મૂળ हिन्दी',editPrice:'100',editDiscount:'0',editPhone:'sample',editLocation:'Sample',editDesc:'Original'};
 for(const [id,value] of Object.entries(values))f.nodes.set(id,{value});
 f.nodes.set('editSubmitBtn',{innerText:'Save Changes',disabled:false});f.nodes.set('editNewImages',{files:[{name:'sample.png'}]});
 const product={docId:'edit-1',sellerUid:'sample-owner',images:['data:image/jpeg;base64,c2FtcGxl']};
 f.context.products=[product];f.context.localStorage={getItem:()=>null,setItem:()=>{throw Error('Unexpected cache mutation');}};
 let rendered=0;f.context.renderProducts=f.context.renderRecentlyViewed=f.context.closeEditAdPage=()=>rendered++;
 f.context.db.collection=()=>({doc:()=>({get:async()=>({exists:true,id:'edit-1',data:()=>product}),update:async data=>f.writes.push({data})})});
 const a=source.indexOf('async function handleEditAdSubmit(e)'),b=source.indexOf('function checkUserPinStatus(user)',a);vm.runInContext(source.slice(a,b),f.context);
 return {...f,edit:()=>f.context.handleEditAdSubmit({preventDefault(){}}),rendered:()=>rendered};
}
test('edit account change during photo processing cannot write or clear the original form',async()=>{
 const f=editFixture();f.context.compressImage=async()=>{f.context.window.currentUser={uid:'other'};return 'data:image/jpeg;base64,c2FtcGxl';};
 await f.edit();assert.equal(f.writes.length,0);assert.equal(f.alerts.length,0);assert.equal(f.rendered(),0);assert.equal(f.nodes.get('editTitle').value,'મૂળ हिन्दी');assert.equal(f.nodes.get('editSubmitBtn').disabled,false);
});
test('late edit completion cannot update the replacement session cache or display success',async()=>{
 const f=editFixture();const old=f.context.products[0];f.context.db.collection=()=>({doc:()=>({update:async data=>{f.writes.push({data});f.context.window.currentUser={uid:'other'};}})});
 await f.edit();assert.equal(f.writes.length,1);assert.equal(f.context.products[0],old);assert.equal(f.alerts.length,0);assert.equal(f.rendered(),0);assert.equal(f.nodes.get('editSubmitBtn').disabled,false);
});
test('normal edit retains the existing update path and guest edit cannot write',async()=>{
 const f=editFixture();await f.edit();assert.equal(f.writes.length,1);assert.equal(f.alerts[0][0],'Success!');assert.equal(f.nodes.get('editSubmitBtn').disabled,false);
 const guest=editFixture();guest.context.window.currentUser=null;await guest.edit();assert.equal(guest.writes.length,0);assert.equal(guest.alerts[0][0],'Login Required');
});
