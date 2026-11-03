import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {isolatedFirestoreContext,safeId,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {normalizeMessageDraft} from '../features/chat/message-text.mjs';
import {authorizeChatMutation} from './chat-message-authorization-policy.mjs';
const roles=['actors','blocks','threads','messages','receipts','audits'];
export const PRODUCT_CONVERSATION_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxProductChat'+k[0].toUpperCase()+k.slice(1)])));
const marketRoles=['actors','privateRecords','publicViews','owners','generations','receipts','audits'];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const productConversationBlockKey=(from,to)=>hash([from,to]);
const fail=code=>({ok:false,code}),revision=v=>Number.isSafeInteger(v)&&v>0&&v<10000;
// Server-only, default off, demo-project/loopback locked. No SDK initialization,
// endpoint, credential handling, persistence in the browser or production mode.
export function createIsolatedProductConversationRepository({enabled=false,firestore,sdk,schema,marketplaceSchema,authenticate,readCursor,issueCursor,timeoutMs=5000,now=Date.now}={}){
 if(enabled!==true)return Object.freeze(Object.fromEntries(['open','send','read','inbox','inboxPage','thread'].map(k=>[k,async()=>fail('UNAVAILABLE')])));
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles}),{collections:m}=isolatedFirestoreContext({firestore,sdk,schema:marketplaceSchema,roles:marketRoles});
 if(Object.values(c).some(v=>Object.values(m).includes(v)))throw new Error('Overlapping private chat mapping');
 const ref=(paths,role,id)=>{if(!safeId(id))throw new Error('Invalid identity');return sdk.doc(db,paths[role],id);};
 const check=context=>isolatedTransactionCheck(context.signal,context.deadlineAt,now);
 const get=async(raw,reference)=>{const s=await raw.get(reference);return s.exists()?s.data():null;};
 async function authority(raw,thread,uid){
  if(!thread||!safeId(thread.id)||!safeId(thread.productId)||!safeId(thread.buyerUid)||!safeId(thread.sellerUid)||thread.buyerUid===thread.sellerUid||![thread.buyerUid,thread.sellerUid].includes(uid)||!revision(thread.revision)||thread.messageCount!==thread.revision||!revision(thread.productRevision))return false;
  const buyer=await get(raw,ref(c,'actors',thread.buyerUid)),seller=await get(raw,ref(c,'actors',thread.sellerUid));
  if([buyer,seller].some((a,i)=>a?.uid!==[thread.buyerUid,thread.sellerUid][i]||a.canInteract!==true||a.suspended!==false))return false;
  const product=await get(raw,ref(m,'privateRecords','product_'+thread.productId)),view=await get(raw,ref(m,'publicViews','product_'+thread.productId)),owner=await get(raw,ref(m,'actors',thread.sellerUid));
  if(product?.id!==thread.productId||product.kind!=='product'||product.archived===true||product.ownerUid!==thread.sellerUid||product.published!==true||product.publicationRevision!==thread.productRevision||view?.id!==thread.productId||view.kind!=='product'||view.revision!==thread.productRevision||view.isSold!==false||JSON.stringify(view)!==JSON.stringify(product.publicProfile)||owner?.uid!==thread.sellerUid||owner.canWrite!==true||owner.suspended!==false)return false;
  if(view.storeId!==null){if(!safeId(view.storeId))return false;const store=await get(raw,ref(m,'privateRecords','store_'+view.storeId));if(store?.id!==view.storeId||store.kind!=='store'||store.ownerUid!==thread.sellerUid||store.published!==true||store.archived===true)return false;}
  const a=await get(raw,ref(c,'blocks',hash([thread.buyerUid,thread.sellerUid]))),b=await get(raw,ref(c,'blocks',hash([thread.sellerUid,thread.buyerUid])));
  return a?.blockerUid===thread.buyerUid&&a.blockedUid===thread.sellerUid&&a.blocked===false&&b?.blockerUid===thread.sellerUid&&b.blockedUid===thread.buyerUid&&b.blocked===false;
 }
 const dto=(thread,uid)=>({id:thread.id,productId:thread.productId,productRevision:thread.productRevision,revision:thread.revision,role:uid===thread.buyerUid?'buyer':'seller'});
 const bounded=(options,run)=>runVerifiedOperation({authenticate,credential:options?.credential,signal:options?.signal,timeoutMs,now,run});
 async function mutate(operation,request,options){
  const input=copyRecord(request,operation==='open'?['requestId','productId','expectedProductRevision','text']:['requestId','threadId','expectedRevision','text']);
  const text=normalizeMessageDraft(input?.text);
  if(!input||!safeId(input.requestId)||!text||operation==='open'&&(!safeId(input.productId)||!revision(input.expectedProductRevision))||operation==='send'&&(!safeId(input.threadId)||!revision(input.expectedRevision)))return fail('INVALID_REQUEST');
  input.text=text;
  return bounded(options,async context=>{const key=hash([context.actorUid,operation,input.requestId]),fingerprint=hash(input);context.markMutationAttempted();return sdk.runTransaction(db,async raw=>{
   check(context);let thread;
   if(operation==='open'){
    const product=await get(raw,ref(m,'privateRecords','product_'+input.productId));if(!safeId(product?.ownerUid)||product.ownerUid===context.actorUid)return fail('DENIED');
    const id=hash([input.productId,context.actorUid,product.ownerUid]);thread={id,productId:input.productId,productRevision:input.expectedProductRevision,buyerUid:context.actorUid,sellerUid:product.ownerUid,revision:1,messageCount:1};
   }else thread=await get(raw,ref(c,'threads',input.threadId));
   if(!await authority(raw,thread,context.actorUid)||!authorizeChatMutation({action:'send',actorUid:context.actorUid,senderUid:context.actorUid,participants:[thread.buyerUid,thread.sellerUid],blocked:false}).ok)return fail('DENIED');
   const previous=operation==='open'?await get(raw,ref(c,'threads',thread.id)):thread,receipt=await get(raw,ref(c,'receipts',key)),audit=await get(raw,ref(c,'audits',key));
   if(receipt){
    if(!previous||previous.id!==thread.id||previous.productId!==thread.productId||previous.productRevision!==thread.productRevision||previous.buyerUid!==thread.buyerUid||previous.sellerUid!==thread.sellerUid||!await authority(raw,previous,context.actorUid))return fail('IDEMPOTENCY_CONFLICT');
    const message=await get(raw,ref(c,'messages',hash([thread.id,receipt.revision])));
    if(receipt.actorUid!==context.actorUid||receipt.fingerprint!==fingerprint||receipt.threadId!==thread.id||!revision(receipt.revision)||previous?.revision<receipt.revision||!previous||audit?.requestKey!==key||audit.actorUid!==context.actorUid||audit.threadId!==thread.id||audit.revision!==receipt.revision||message?.threadId!==thread.id||message.sequence!==receipt.revision||message.senderUid!==context.actorUid||message.text!==text)return fail('IDEMPOTENCY_CONFLICT');
    return {ok:true,status:'replayed',thread: dto({...thread,revision:receipt.revision},context.actorUid)};
   }
   if(audit||operation==='open'&&previous||operation==='send'&&thread.revision!==input.expectedRevision)return fail('REVISION_CONFLICT');
   const sequence=operation==='open'?1:thread.revision+1;if(!revision(sequence))return fail('LIMIT_REACHED');
   const messageRef=ref(c,'messages',hash([thread.id,sequence]));if(await get(raw,messageRef))return fail('REVISION_CONFLICT');const next={...thread,revision:sequence,messageCount:sequence};check(context);
   raw.set(ref(c,'threads',thread.id),next);raw.set(messageRef,{threadId:thread.id,sequence,senderUid:context.actorUid,text,committedAt:sdk.serverTimestamp()});raw.set(ref(c,'receipts',key),{actorUid:context.actorUid,fingerprint,threadId:thread.id,revision:sequence});raw.set(ref(c,'audits',key),{requestKey:key,actorUid:context.actorUid,threadId:thread.id,revision:sequence,operation});check(context);
   return {ok:true,status:'sent',thread:dto(next,context.actorUid)};
  },{maxAttempts:3});});
 }
 async function readInbox(request,options,paged){
  const input=copyRecord(request,paged?['role','limit','cursor']:['role','limit']);if(!input||!['buyer','seller'].includes(input.role)||!Number.isInteger(input.limit)||input.limit<1||input.limit>20||paged&&input.cursor!==null&&(typeof input.cursor!=='string'||input.cursor.length<1||input.cursor.length>1024))return fail('INVALID_REQUEST');
  if(paged&&![readCursor,issueCursor].every(f=>typeof f==='function'))return fail('UNAVAILABLE');
  return bounded(options,async context=>{const scope=hash(['product-inbox-v1',context.actorUid,input.role,input.limit]);let anchor=null;
   if(paged&&input.cursor!==null){anchor=copyRecord(await readCursor(input.cursor),['scope','after','revision']);check(context);if(!anchor||anchor.scope!==scope||!safeId(anchor.after)||!revision(anchor.revision))return fail('CURSOR_INVALID');}
   const snapshot=await sdk.getDocsFromServer(sdk.query(sdk.collection(db,c.threads),sdk.where(input.role+'Uid','==',context.actorUid),sdk.orderBy('id','asc'),...(anchor?[sdk.startAfter(anchor.after)]:[]),sdk.limit(input.limit+(paged?1:0))));check(context);
   if(snapshot.metadata?.fromCache!==false||snapshot.metadata?.hasPendingWrites!==false||snapshot.docs.length>input.limit+(paged?1:0))return fail('UNAVAILABLE');
   const result=await sdk.runTransaction(db,async raw=>{if(anchor){const a=await get(raw,ref(c,'threads',anchor.after));if(a?.revision!==anchor.revision||a[input.role+'Uid']!==context.actorUid||!await authority(raw,a,context.actorUid))return fail('CURSOR_INVALID');}
    const items=[];let previous=anchor?.after??null;for(const row of snapshot.docs){const value=await get(raw,ref(c,'threads',row.id));if(value?.id!==row.id||previous!==null&&value.id<=previous||value[input.role+'Uid']!==context.actorUid||!await authority(raw,value,context.actorUid))return fail('DENIED');previous=value.id;items.push(dto(value,context.actorUid));}check(context);return {ok:true,items};},{maxAttempts:3});
   if(!result.ok)return result;const items=result.items.slice(0,input.limit);let nextCursor=null;if(paged&&result.items.length>input.limit){const last=items.at(-1);nextCursor=await issueCursor({scope,after:last.id,revision:last.revision});check(context);if(typeof nextCursor!=='string'||nextCursor.length<1||nextCursor.length>1024)return fail('UNAVAILABLE');}return {ok:true,items,bounded:true,...(paged?{nextCursor}:{} )};
  });
 }
 return Object.freeze({open:(r,o)=>mutate('open',r,o),send:(r,o)=>mutate('send',r,o),
  async read(request,options){const input=copyRecord(request,['threadId','expectedRevision','afterSequence','limit']);if(!input||!safeId(input.threadId)||!revision(input.expectedRevision)||!Number.isInteger(input.afterSequence)||input.afterSequence<0||input.afterSequence>=input.expectedRevision||!Number.isInteger(input.limit)||input.limit<1||input.limit>20)return fail('INVALID_REQUEST');
   return bounded(options,context=>sdk.runTransaction(db,async raw=>{check(context);const thread=await get(raw,ref(c,'threads',input.threadId));if(!await authority(raw,thread,context.actorUid))return fail('DENIED');if(thread.revision!==input.expectedRevision)return fail('REVISION_CONFLICT');const messages=[];for(let n=input.afterSequence+1;n<=Math.min(thread.messageCount,input.afterSequence+input.limit);n++){const msg=await get(raw,ref(c,'messages',hash([thread.id,n])));if(msg?.threadId!==thread.id||msg.sequence!==n||![thread.buyerUid,thread.sellerUid].includes(msg.senderUid)||normalizeMessageDraft(msg.text)!==msg.text)return fail('UNAVAILABLE');messages.push({sequence:n,senderRole:msg.senderUid===thread.buyerUid?'buyer':'seller',text:msg.text});}check(context);return {ok:true,thread:dto(thread,context.actorUid),messages,hasMore:input.afterSequence+messages.length<thread.messageCount};},{maxAttempts:3}));
  },
  inbox:(request,options)=>readInbox(request,options,false),inboxPage:(request,options)=>readInbox(request,options,true),
  async thread(request,options){const input=copyRecord(request,['threadId']);if(!input||!safeId(input.threadId))return fail('INVALID_REQUEST');return bounded(options,context=>sdk.runTransaction(db,async raw=>{check(context);const value=await get(raw,ref(c,'threads',input.threadId));if(value?.id!==input.threadId||!await authority(raw,value,context.actorUid))return fail('DENIED');check(context);return {ok:true,thread:dto(value,context.actorUid)};},{maxAttempts:3}));}

 });
}
