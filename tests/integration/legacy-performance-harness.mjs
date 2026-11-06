import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
export const legacySource=await readFile(new URL('../../index.html',import.meta.url),'utf8');
export function part(a,b){const start=legacySource.indexOf(a),end=legacySource.indexOf(b,start);if(start<0||end<=start)throw Error('Missing source marker '+a);return legacySource.slice(start,end);}
export function queryDb(read,listen=()=>()=>{}){
 function query(plan){const next=patch=>query({...plan,...patch});return {
 collection:name=>next({path:[...plan.path,name]}),doc:id=>next({path:[...plan.path,id]}),where:(...v)=>next({where:[...plan.where,v]}),orderBy:(...v)=>next({order:[...plan.order,v]}),limit:limit=>next({limit}),startAfter:cursor=>next({cursor}),get:options=>read({...plan,options}),onSnapshot:(ok,error)=>listen(plan,ok,error)
 };}return {collection:name=>query({path:[name],where:[],order:[],limit:null,cursor:null})};
}
export function feedHarness(read,user=null){
 const context={window:{currentUser:user},document:{documentElement:{lang:'en'},getElementById:()=>null},db:queryDb(read),firebase:{firestore:{FieldPath:{documentId:()=> '__name__'}}},renderProducts(){},renderRecentlyViewed(){},updateProfileDetails(){},localStorage:{getItem(){throw Error('No partial cache pruning');},setItem(){throw Error('No partial cache pruning');}}};
 runInNewContext('let productsReadGeneration=0,productFeedState=null,products=[],hasMoreProducts=true,isFetchingProducts=false;const PRODUCT_PAGE_SIZE=12;'+part('function legacyReadCopy(', '// Initial fetch call')+';this.start=listenToProductsFromFirebase;this.next=()=>loadProductPage(productFeedState);this.rows=()=>products;this.state=()=>productFeedState;this.ack=syncAcknowledgedProduct;',context);return context;
}
export function inboxHarness(read,listen){
 const badge={style:{}},user={uid:'viewer'},context={window:{currentUser:user},document:{getElementById:()=>badge},db:queryDb(read,listen),firebase:{firestore:{FieldPath:{documentId:()=> '__name__'}}},legacyReadCopy:key=>key};
 const events=new EventTarget();Object.assign(context.document,{documentElement:{dataset:{}},addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events)});
 runInNewContext('let legacyInboxGeneration=0,legacyInboxJob=null,inboxListenerUnsubscribe=null,inboxViewGeneration=0;'+part('function invalidateLegacyInbox()', 'function calculatePrices(')+';this.read=readLegacyInboxSummaries;this.badge=refreshLegacyInboxBadge;this.invalidate=invalidateLegacyInbox;this.watch=startGlobalUnreadMessagesListener;',context);return {context,user,badge};
}
export const document=(id,data)=>({id,data:()=>data});
export function syntheticRead(records,requests=[]){return async plan=>{
 requests.push(plan);if(plan.options?.source!=='server'||!Number.isInteger(plan.limit)||plan.limit<1||plan.limit>50)throw Error('Unbounded/non-server query');
 let docs=(records[plan.path.join('/')]||[]).slice();
 for(const [field,op,value] of plan.where)docs=docs.filter(doc=>{const v=doc.data()[field];return op==='array-contains'?Array.isArray(v)&&v.includes(value):op==='!='?v!==undefined&&v!==value:v===value;});
 for(const [field] of plan.order)if(field!=='__name__')docs=docs.filter(doc=>Object.hasOwn(doc.data(),field));
 const comparable=(doc,key)=>key==='__name__'?doc.id:doc.data()[key]?.seconds??doc.data()[key];
 docs.sort((a,b)=>{for(const [field,direction] of plan.order){const av=comparable(a,field),bv=comparable(b,field);if(av!==bv)return (av>bv?1:-1)*(direction==='desc'?-1:1);}return 0;});
 if(plan.cursor){const index=docs.findIndex(doc=>doc.id===plan.cursor.id);if(index<0)throw Error('Unknown cursor');docs=docs.slice(index+1);}
 return {docs:docs.slice(0,plan.limit),metadata:{fromCache:false,hasPendingWrites:false}};
};}
