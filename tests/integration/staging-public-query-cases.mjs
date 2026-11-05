import assert from 'node:assert/strict';
import {createStagingMarketplacePublicRepository} from '../../scripts/firebase-marketplace-repository.mjs';
export async function exerciseNativePublicReads({binding:b,Filter,seed,read}){
 const c=b.collections,book=new Map();let sequence=0;
 await seed(c.actors,'browse-owner',{uid:'browse-owner',canWrite:true,suspended:false});await seed(c.generations,'current',{value:100});
 const product=id=>({id,kind:'product',revision:1,title:'Synthetic Gujarati મૂળ हिन्दी',description:'Synthetic test only',category:'cars',locationLabel:'Sample Gujarat',basePrice:100,isSold:false,storeId:null});
 for(const id of ['synthetic-browse-a','synthetic-browse-b']){const row=product(id);await seed(c.publicViews,'product_'+id,row);await seed(c.privateRecords,'product_'+id,{id,kind:'product',ownerUid:'browse-owner',revision:1,published:true,publicationRevision:1,publicProfile:row,privateContact:'never-public',profile:{...row,photos:[]}});}
 const repo=createStagingMarketplacePublicRepository({enabled:true,binding:b,Filter,issueCursor:async payload=>{const key='synthetic-cursor-'+(++sequence);book.set(key,payload);return key;},readCursor:async key=>book.get(key)??null});
 const request={kind:'product',limit:1,category:'cars',storeId:null,cursor:null},first=await repo.list(request);assert.equal(first.ok,true,JSON.stringify(first));assert.equal(first.items.length,1);assert.ok(first.nextCursor);assert.equal(first.items[0].id,'synthetic-browse-a');assert.ok(!JSON.stringify(first).includes('privateContact'));assert.ok(!JSON.stringify(first).includes('ownerUid'));
 const second=await repo.list({...request,cursor:first.nextCursor});assert.equal(second.ok,true);assert.equal(second.items[0].id,'synthetic-browse-b');assert.equal(second.nextCursor,null);
 assert.equal((await repo.list({...request,category:'electronics',cursor:first.nextCursor})).ok,false);assert.equal((await repo.list({...request,cursor:'forged'})).code,'CURSOR_INVALID');assert.equal((await repo.list({...request,limit:25})).ok,false);
 const detail=await repo.detail({kind:'product',id:'synthetic-browse-a'});assert.equal(detail.ok,true);assert.ok(!JSON.stringify(detail).includes('privateContact'));
 const parent=await read(c.privateRecords,'product_synthetic-browse-a');await seed(c.privateRecords,'product_synthetic-browse-a',{...parent,published:false});await seed(c.generations,'current',{value:101});
 assert.equal((await repo.detail({kind:'product',id:'synthetic-browse-a'})).ok,false);assert.equal((await repo.list({...request,cursor:first.nextCursor})).code,'CURSOR_INVALID');
 // An orphaned/withdrawn public row is not silently served even on a fresh page.
 assert.equal((await repo.list(request)).ok,false);
 await seed(c.privateRecords,'product_synthetic-browse-a',parent);
 const store={id:'synthetic-browse-store',kind:'store',revision:1,name:'Synthetic shop',description:'Sample only',category:'electronics',categories:['electronics','cars'],locationLabel:'Sample Gujarat'};
 await seed(c.publicViews,'store_'+store.id,store);await seed(c.privateRecords,'store_'+store.id,{id:store.id,kind:'store',ownerUid:'browse-owner',revision:1,published:true,publicationRevision:1,publicProfile:store});
 const stores=await repo.list({kind:'store',limit:2,category:'cars',storeId:null,cursor:null});assert.equal(stores.ok,true,JSON.stringify(stores));assert.equal(stores.items[0].id,store.id);
 await seed(c.actors,'browse-owner',{uid:'browse-owner',canWrite:true,suspended:true});assert.equal((await repo.detail({kind:'store',id:store.id})).ok,false);
}
