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
 const context=vm.createContext({Object,Event,parseFloat,Math,console:{log(){},warn:(...v)=>warnings.push(v)},window:{currentUser:{uid:'sample-owner',displayName:'Sample'}},document:{getElementById:id=>nodes.get(id)||null},selectedMainCat:{id:'mobiles'},selectedSubCat:'Mobile Phones',selectedCoords:null,firebase:{firestore:{FieldValue:{serverTimestamp:()=> 'synthetic-time'}}},fetch:async()=>({json:async()=>({ip:'synthetic-only'})}),compressImage:async()=>{if(imageError)throw Error('private photo failure');return 'data:image/jpeg;base64,c2FtcGxl';},db:{collection:name=>({add:async data=>{writes.push({name,data});if(error)throw error;}})},showCustomAlert:(...v)=>alerts.push(v),openAuthModal(){}});
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
