import {reconciledPhysicalPrefix,validReconciledReadProof} from './reconciled-chat-cursor.mjs';
import {productMessageFacts,productMessageVisible} from './product-message-facts.mjs';
import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {isolatedFirestoreContext,safeId,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {normalizeMessageDraft} from '../features/chat/message-text.mjs';
import {initialReadState,validReadState} from './trusted-chat-read-state.mjs';
import {advanceReadCursor} from './chat-read-receipt-policy.mjs';
import {validateInboxSummary} from './inbox-summary-policy.mjs';
import {authorizeChatMutation} from './chat-message-authorization-policy.mjs';
const roles=['actors','blocks','threads','messages','receipts','audits'];
export const PRODUCT_CONVERSATION_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxProductChat'+k[0].toUpperCase()+k.slice(1)])));
const marketRoles=['actors','privateRecords','publicViews','owners','generations','receipts','audits'];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const productConversationBlockKey=(from,to)=>hash([from,to]);
const fail=code=>({ok:false,code}),revision=v=>Number.isSafeInteger(v)&&v>0&&v<10000;
// Server-only, default off, demo-project/loopback locked. No SDK initialization,
// endpoint, credential handling, persistence in the browser or production mode.
export function createIsolatedProductConversationRepository({enabled=false,firestore,sdk,schema,marketplaceSchema,authenticate,readCursor,issueCursor,readStateEnabled=false,notificationOutbox=null,inboxIndex=null,legacyMutationsEnabled=false,reconciledHistoryEnabled=false,timeoutMs=5000,now=Date.now}={}){
 if(enabled!==true)return Object.freeze(Object.fromEntries(['open','send','read','inbox','inboxPage','inboxSummaries','thread','summary','acknowledge','changeVisibility','changeBlock'].map(k=>[k,async()=>fail('UNAVAILABLE')])));
 if(typeof reconciledHistoryEnabled!=='boolean')throw Error('Explicit reconciled-history gate required');
 if(reconciledHistoryEnabled&&(!readStateEnabled||!inboxIndex))throw Error('Reconciled history requires trusted state/index');
 if(typeof legacyMutationsEnabled!=='boolean')throw Error('Explicit legacy mutation gate required');
 if(typeof readStateEnabled!=='boolean')throw Error('Explicit read-state gate required');
 if(readStateEnabled&&![readCursor,issueCursor].every(f=>typeof f==='function'))throw Error('Verified read receipt ports required');
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles}),{collections:m}=isolatedFirestoreContext({firestore,sdk,schema:marketplaceSchema,roles:marketRoles});
 if(Object.values(c).some(v=>Object.values(m).includes(v)))throw new Error('Overlapping private chat mapping');
 const ref=(paths,role,id)=>{if(!safeId(id))throw new Error('Invalid identity');return sdk.doc(db,paths[role],id);};
 const check=context=>isolatedTransactionCheck(context.signal,context.deadlineAt,now);
 const get=async(raw,reference)=>{const s=await cached(raw).get(reference);return s.exists()?s.data():null;};
 async function authority(raw,thread,uid,{checkBlocks=true,checkIndex=true,allowReconciled=false}={}){
  if(!thread||!safeId(thread.id)||!safeId(thread.productId)||!safeId(thread.buyerUid)||!safeId(thread.sellerUid)||thread.buyerUid===thread.sellerUid||![thread.buyerUid,thread.sellerUid].includes(uid)||!revision(thread.revision)||thread.messageCount!==thread.revision||!revision(thread.productRevision))return false;
  if(Object.hasOwn(thread,'inboxIndexed')&&thread.inboxIndexed!==true)return false;if(checkIndex&&thread.inboxIndexed===true&&(!inboxIndex||!await inboxIndex.assertAccessible(raw,{actorUid:uid,kind:'product',threadId:thread.id,revision:thread.revision})&&!(allowReconciled&&await reconciledRow(raw,thread,uid))))return false;
  const buyer=await get(raw,ref(c,'actors',thread.buyerUid)),seller=await get(raw,ref(c,'actors',thread.sellerUid));
  if([buyer,seller].some((a,i)=>a?.uid!==[thread.buyerUid,thread.sellerUid][i]||a.canInteract!==true||a.suspended!==false))return false;
  const product=await get(raw,ref(m,'privateRecords','product_'+thread.productId)),view=await get(raw,ref(m,'publicViews','product_'+thread.productId)),owner=await get(raw,ref(m,'actors',thread.sellerUid));
  if(product?.id!==thread.productId||product.kind!=='product'||product.archived===true||product.ownerUid!==thread.sellerUid||product.published!==true||product.publicationRevision!==thread.productRevision||view?.id!==thread.productId||view.kind!=='product'||view.revision!==thread.productRevision||view.isSold!==false||JSON.stringify(view)!==JSON.stringify(product.publicProfile)||owner?.uid!==thread.sellerUid||owner.canWrite!==true||owner.suspended!==false)return false;
  if(view.storeId!==null){if(!safeId(view.storeId))return false;const store=await get(raw,ref(m,'privateRecords','store_'+view.storeId));if(store?.id!==view.storeId||store.kind!=='store'||store.ownerUid!==thread.sellerUid||store.published!==true||store.archived===true)return false;}
  if(!checkBlocks)return true; // Notification policy checks BOTH fresh edges separately.
  const a=await get(raw,ref(c,'blocks',hash([thread.buyerUid,thread.sellerUid]))),b=await get(raw,ref(c,'blocks',hash([thread.sellerUid,thread.buyerUid])));
  return a?.blockerUid===thread.buyerUid&&a.blockedUid===thread.sellerUid&&a.blocked===false&&b?.blockerUid===thread.sellerUid&&b.blockedUid===thread.buyerUid&&b.blocked===false;
 }
 if(inboxIndex&&!readStateEnabled)throw Error('Index requires trusted read state');
 inboxIndex?.assertCompatible(db,[...Object.values(c),...Object.values(m),...Object.values(notificationOutbox?.collections??{})]);
 notificationOutbox?.assertCompatible(db,[...Object.values(c),...Object.values(m),...Object.values(inboxIndex?.collections??{})]);
 const roleOf=(thread,uid)=>uid===thread.buyerUid?'buyer':'seller';
 const deliveryScope=(thread,uid)=>hash(['product-read-v1',thread.id,uid,thread.productId,thread.productRevision]);
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
   if(!await authority(raw,thread,context.actorUid,{allowReconciled:reconciledHistoryEnabled})||!authorizeChatMutation({action:'send',actorUid:context.actorUid,senderUid:context.actorUid,participants:[thread.buyerUid,thread.sellerUid],blocked:false}).ok)return fail('DENIED');
   const previous=operation==='open'?await get(raw,ref(c,'threads',thread.id)):thread,receipt=await get(raw,ref(c,'receipts',key)),audit=await get(raw,ref(c,'audits',key));
   if(receipt){
    if(!previous||previous.id!==thread.id||previous.productId!==thread.productId||previous.productRevision!==thread.productRevision||previous.buyerUid!==thread.buyerUid||previous.sellerUid!==thread.sellerUid||!await authority(raw,previous,context.actorUid,{allowReconciled:reconciledHistoryEnabled}))return fail('IDEMPOTENCY_CONFLICT');
    const message=await get(raw,ref(c,'messages',hash([thread.id,receipt.revision])));
    if(receipt.actorUid!==context.actorUid||receipt.fingerprint!==fingerprint||receipt.threadId!==thread.id||!revision(receipt.revision)||previous?.revision<receipt.revision||!previous||audit?.requestKey!==key||audit.actorUid!==context.actorUid||audit.threadId!==thread.id||audit.revision!==receipt.revision||message?.threadId!==thread.id||message.sequence!==receipt.revision||message.senderUid!==context.actorUid||message.text!==text)return fail('IDEMPOTENCY_CONFLICT');
    return {ok:true,status:'replayed',thread: dto({...thread,revision:receipt.revision},context.actorUid)};
   }
   if(previous?.inboxIndexed===true&&!inboxIndex)return fail('INDEX_REQUIRED');
   if(previous?.readState&&!readStateEnabled)return fail('READ_STATE_REQUIRED');
   if(readStateEnabled&&previous&&!validReadState(previous))return fail('READ_STATE_UNAVAILABLE');
   if(audit||operation==='open'&&previous||operation==='send'&&thread.revision!==input.expectedRevision)return fail('REVISION_CONFLICT');
   const sequence=operation==='open'?1:thread.revision+1;if(!revision(sequence))return fail('LIMIT_REACHED');
   const messageRef=ref(c,'messages',hash([thread.id,sequence]));if(await get(raw,messageRef))return fail('REVISION_CONFLICT');const state=readStateEnabled?{...(previous?.readState??initialReadState())}:null;if(state){const recipient=context.actorUid===thread.buyerUid?'seller':'buyer';state[recipient+'Received']++;state.lastSenderUid=context.actorUid;state.lastPreview=text.slice(0,160);state.lastMessageAtMillis=now();}const next={...thread,revision:sequence,messageCount:sequence,...(inboxIndex?{inboxIndexed:true}:{}),...(state?{readState:state}:{})};if(state&&!validReadState(next))return fail('READ_STATE_UNAVAILABLE');check(context);
   const title=inboxIndex?(await get(raw,ref(m,'publicViews','product_'+thread.productId))).title.slice(0,160):null,reconciled=previous&&await reconciledRow(raw,previous,context.actorUid);const indexCommit=inboxIndex?(reconciled?await inboxIndex.stageReconciledSend(raw,{before:previous,after:next,title}):await inboxIndex.stageConversation(raw,{kind:'product',before:previous,after:next,title})):null;check(context);
   const enqueue=notificationOutbox?await notificationOutbox.stage(raw,{kind:'product',threadId:thread.id,sequence,senderUid:context.actorUid,recipientUid:context.actorUid===thread.buyerUid?thread.sellerUid:thread.buyerUid}):null;check(context);
   raw.set(ref(c,'threads',thread.id),next);raw.set(messageRef,{threadId:thread.id,sequence,senderUid:context.actorUid,text,...(state?{readPrefix:{buyerReceived:state.buyerReceived,sellerReceived:state.sellerReceived}}:{}),committedAt:sdk.serverTimestamp()});raw.set(ref(c,'receipts',key),{actorUid:context.actorUid,fingerprint,threadId:thread.id,revision:sequence});raw.set(ref(c,'audits',key),{requestKey:key,actorUid:context.actorUid,threadId:thread.id,revision:sequence,operation});enqueue?.();indexCommit?.();check(context);
   return {ok:true,status:'sent',thread:dto(next,context.actorUid)};
  },{maxAttempts:3});});
 }
 const reconciledRow=(raw,t,uid)=>reconciledHistoryEnabled&&t?.inboxIndexed===true?inboxIndex.readyRow(raw,{actorUid:uid,kind:'product',threadId:t.id,revision:t.revision}).then(r=>r?.mode==='reconciled'?r:null):Promise.resolve(null);
 const reconciledScope=(t,uid,epoch)=>hash(['product-reconciled-read-v1',t.id,uid,t.productId,t.productRevision,epoch]);
 const physicalPrefix=(message,thread,n)=>reconciledPhysicalPrefix(message,thread.readState,n);
 async function readReconciled(raw,thread,row,input,context){const messages=[];let visibleIncoming=0,physicalIncoming=0;const throughSequence=Math.min(thread.revision,input.afterSequence+input.limit),role=roleOf(thread,context.actorUid);
  for(let n=input.afterSequence+1;n<=throughSequence;n++){const msg=await get(raw,ref(c,'messages',hash([thread.id,n]))),facts=productMessageFacts(msg,thread),prefix=physicalPrefix(msg,thread,n);if(!facts||msg.sequence!==n||!prefix)return fail('READ_STATE_UNAVAILABLE');physicalIncoming=prefix[role+'Received'];if(productMessageVisible(msg,thread,context.actorUid)){if(normalizeMessageDraft(msg.text)!==msg.text)return fail('READ_STATE_UNAVAILABLE');messages.push({sequence:n,senderRole:msg.senderUid===thread.buyerUid?'buyer':'seller',text:msg.text});if(msg.senderUid!==context.actorUid)visibleIncoming++;}}
  context.checkpoint();return {ok:true,thread:dto(thread,context.actorUid),messages,throughSequence,hasMore:throughSequence<thread.revision,delivery:{scope:reconciledScope(thread,context.actorUid,row.inventoryEpoch),afterSequence:input.afterSequence,throughSequence,visibleIncoming,physicalIncoming}};
 }
 async function acknowledgeReconciled(input,proof,context){if(!reconciledHistoryEnabled||!validReconciledReadProof(proof))return fail('INVALID_READ_RECEIPT');
  return sdk.runTransaction(db,async raw=>{check(context);const thread=await get(raw,ref(c,'threads',input.threadId));if(thread?.id!==input.threadId||!await authority(raw,thread,context.actorUid,{allowReconciled:true})||!validReadState(thread))return fail('DENIED');const row=await reconciledRow(raw,thread,context.actorUid),role=roleOf(thread,context.actorUid),r=thread.readState;
   if(!row||proof.scope!==reconciledScope(thread,context.actorUid,row.inventoryEpoch)||proof.throughSequence>thread.revision||proof.physicalIncoming>r[role+'Received'])return fail('INVALID_READ_RECEIPT');if(row.item.readSequence!==r[role+'ReadSequence'])return fail('READ_STATE_UNAVAILABLE');
   if(proof.throughSequence<=row.item.readSequence)return {ok:true,status:'unchanged',readSequence:row.item.readSequence};if(proof.afterSequence!==row.item.readSequence)return fail('READ_GAP');if(proof.visibleIncoming>row.item.unreadCount||proof.physicalIncoming<r[role+'ReadCount'])return fail('INVALID_READ_RECEIPT');
   const key=hash(['product-reconciled-ack-v1',context.actorUid,thread.id,row.inventoryEpoch,proof.throughSequence]),receipt=await get(raw,ref(c,'receipts',key)),audit=await get(raw,ref(c,'audits',key));if(receipt||audit)return fail('READ_STATE_UNAVAILABLE');const commit=await inboxIndex.stageReconciledRead(raw,{row,throughSequence:proof.throughSequence,visibleIncoming:proof.visibleIncoming}),next={...thread,readState:{...r,[role+'ReadSequence']:proof.throughSequence,[role+'ReadCount']:proof.physicalIncoming}},record={actorUid:context.actorUid,threadId:thread.id,inventoryEpoch:row.inventoryEpoch,readSequence:proof.throughSequence,visibleIncoming:proof.visibleIncoming,physicalIncoming:proof.physicalIncoming};if(!validReadState(next))return fail('READ_STATE_UNAVAILABLE');check(context);context.markMutationAttempted();raw.set(ref(c,'threads',thread.id),next);raw.set(ref(c,'receipts',key),record);raw.set(ref(c,'audits',key),{...record,operation:'read.reconciled.acknowledge'});commit();check(context);return {ok:true,status:'advanced',readSequence:proof.throughSequence};
  },{maxAttempts:3});
 }
 // Source mutations invalidate both complete actor inventories in the SAME SDK
 // transaction. Clients cannot supply counts, roles, target UIDs or source epochs.
 async function legacyMutation(operation,request,options){
  if(!legacyMutationsEnabled||!inboxIndex||!readStateEnabled)return fail('UNAVAILABLE');
  const input=copyRecord(request,operation==='visibility'?['requestId','threadId','expectedRevision','sequence','action']:['requestId','threadId','expectedRevision','expectedBlocked','blocked']);
  if(!input||!safeId(input.requestId)||!safeId(input.threadId)||!revision(input.expectedRevision)||(operation==='visibility'?(!revision(input.sequence)||!['hide_for_self','delete_for_everyone'].includes(input.action)):(typeof input.blocked!=='boolean'||typeof input.expectedBlocked!=='boolean')))return fail('INVALID_REQUEST');
  return bounded(options,context=>sdk.runTransaction(db,async raw=>{
   check(context);const thread=await get(raw,ref(c,'threads',input.threadId));
   // Privacy edits/unblock remain possible while reconciliation is pending.
   // Actor/product/participant authorization remains mandatory.
   if(thread?.id!==input.threadId||!await authority(raw,thread,context.actorUid,{checkBlocks:false,checkIndex:false})||thread.inboxIndexed!==true||!validReadState(thread))return fail('DENIED');
   const key=hash(['legacy-chat-v1',context.actorUid,operation,input.requestId]),fingerprint=hash(input),receiptRef=ref(c,'receipts',key),auditRef=ref(c,'audits',key),receipt=await get(raw,receiptRef),audit=await get(raw,auditRef);
   const record={actorUid:context.actorUid,operation:'legacy.'+operation,requestId:input.requestId,threadId:thread.id,sourceRevision:input.expectedRevision,action:operation==='visibility'?input.action:(input.blocked?'block':'unblock'),sequence:operation==='visibility'?input.sequence:null,fingerprint,inventoryEpoch:key};
   if(receipt||audit){if(![receipt,audit].every(v=>copyRecord(v,Object.keys(record))&&Object.entries(record).every(([k,value])=>v[k]===value)))return fail('IDEMPOTENCY_CONFLICT');return {ok:true,status:'replayed'};}
   if(thread.revision!==input.expectedRevision)return fail('REVISION_CONFLICT');
   let target,next;
   if(operation==='visibility'){
    if(input.sequence>thread.revision)return fail('INVALID_REQUEST');target=ref(c,'messages',hash([thread.id,input.sequence]));const message=await get(raw,target),facts=productMessageFacts(message,thread);
    if(!facts||message.sequence!==input.sequence)return fail('READ_STATE_UNAVAILABLE');
    if(!authorizeChatMutation({action:input.action,actorUid:context.actorUid,senderUid:message.senderUid,participants:[thread.buyerUid,thread.sellerUid],targetUid:context.actorUid,tombstoned:facts.deletedForEveryone}).ok)return fail('DENIED');
    next=input.action==='hide_for_self'?{...message,hiddenFor:[...new Set([...facts.hiddenFor,context.actorUid])]}:{...message,deletedForEveryone:true,text:''};
   }else{
    const other=context.actorUid===thread.buyerUid?thread.sellerUid:thread.buyerUid;target=ref(c,'blocks',hash([context.actorUid,other]));const edge=copyRecord(await get(raw,target),['blockerUid','blockedUid','blocked']);
    if(!edge||edge.blockerUid!==context.actorUid||edge.blockedUid!==other||typeof edge.blocked!=='boolean')return fail('DENIED');
    if(edge.blocked!==input.expectedBlocked)return fail('REVISION_CONFLICT');next={...edge,blocked:input.blocked};
   }
   const invalidate=await inboxIndex.stageInvalidation(raw,[thread.buyerUid,thread.sellerUid].map(actorUid=>({actorUid,nextEpoch:key})));check(context);context.markMutationAttempted();
   raw.set(target,next);raw.set(receiptRef,record);raw.set(auditRef,record);invalidate();check(context);return {ok:true,status:'changed'};
  },{maxAttempts:3}));
 }
 async function readInbox(request,options,paged,withReadState=false){
  if(withReadState&&!readStateEnabled)return fail('UNAVAILABLE');
  const input=copyRecord(request,paged?['role','limit','cursor']:['role','limit']);if(!input||!['buyer','seller'].includes(input.role)||!Number.isInteger(input.limit)||input.limit<1||input.limit>20||paged&&input.cursor!==null&&(typeof input.cursor!=='string'||input.cursor.length<1||input.cursor.length>1024))return fail('INVALID_REQUEST');
  if(paged&&![readCursor,issueCursor].every(f=>typeof f==='function'))return fail('UNAVAILABLE');
  return bounded(options,async context=>{const scope=hash([withReadState?'product-inbox-summary-v1':'product-inbox-v1',context.actorUid,input.role,input.limit]);let anchor=null;
   if(paged&&input.cursor!==null){anchor=copyRecord(await readCursor(input.cursor),['scope','after','revision']);check(context);if(!anchor||anchor.scope!==scope||!safeId(anchor.after)||!revision(anchor.revision))return fail('CURSOR_INVALID');}
   const snapshot=await sdk.getDocsFromServer(sdk.query(sdk.collection(db,c.threads),sdk.where(input.role+'Uid','==',context.actorUid),sdk.orderBy('id','asc'),...(anchor?[sdk.startAfter(anchor.after)]:[]),sdk.limit(input.limit+(paged?1:0))));check(context);
   if(snapshot.metadata?.fromCache!==false||snapshot.metadata?.hasPendingWrites!==false||snapshot.docs.length>input.limit+(paged?1:0))return fail('UNAVAILABLE');
   const result=await sdk.runTransaction(db,async raw=>{if(anchor){const a=await get(raw,ref(c,'threads',anchor.after));if(a?.revision!==anchor.revision||a[input.role+'Uid']!==context.actorUid||!await authority(raw,a,context.actorUid))return fail('CURSOR_INVALID');}
    const items=[];let previous=anchor?.after??null;for(const row of snapshot.docs){const value=await get(raw,ref(c,'threads',row.id));if(value?.id!==row.id||previous!==null&&value.id<=previous||value[input.role+'Uid']!==context.actorUid||!await authority(raw,value,context.actorUid))return fail('DENIED');previous=value.id;if(withReadState&&!validReadState(value))return fail('READ_STATE_UNAVAILABLE');const role=roleOf(value,context.actorUid);items.push({...dto(value,context.actorUid),...(withReadState?{unreadCount:value.readState[role+'Received']-value.readState[role+'ReadCount'],readSequence:value.readState[role+'ReadSequence']}:{} )});}check(context);return {ok:true,items};},{maxAttempts:3});
   if(!result.ok)return result;const items=result.items.slice(0,input.limit);let nextCursor=null;if(paged&&result.items.length>input.limit){const last=items.at(-1);nextCursor=await issueCursor({scope,after:last.id,revision:last.revision});check(context);if(typeof nextCursor!=='string'||nextCursor.length<1||nextCursor.length>1024)return fail('UNAVAILABLE');}return {ok:true,items,bounded:true,...(paged?{nextCursor}:{} )};
  });
 }
 // The cache is scoped to each SDK transaction/attempt, never a user/session.
 // Concrete canonical-domain readers for the existing notification privacy policy.
 // Worker role and recipient preferences remain REQUIRED injected server readers.
 const transactionReads=new WeakMap();
 function cached(raw){if(!transactionReads.has(raw)){const reads=new Map();transactionReads.set(raw,{get(reference){if(!reads.has(reference.path))reads.set(reference.path,raw.get(reference));return reads.get(reference.path);}});}return transactionReads.get(raw);}
 const notificationReaders=Object.freeze({
  async readThread(raw,event){if(event?.kind!=='product'||!safeId(event.threadId)||!safeId(event.recipientUid))return null;const tx=raw,t=await get(tx,ref(c,'threads',event.threadId));if(!await authority(tx,t,event.recipientUid,{checkBlocks:false}))return null;return {kind:'product',threadId:t.id,participantUids:[t.buyerUid,t.sellerUid],active:true,revision:t.revision};},
  async readMessage(raw,event){if(event?.kind!=='product'||!safeId(event.threadId)||!Number.isSafeInteger(event.sequence)||event.sequence<1||event.sequence>9999)return null;const tx=raw,t=await get(tx,ref(c,'threads',event.threadId)),m=await get(tx,ref(c,'messages',hash([event.threadId,event.sequence])));if(!t||!validReadState(t))return null;const prefix=copyRecord(m?.readPrefix,['buyerReceived','sellerReceived']);if(!prefix||!['buyer','seller'].every(role=>Number.isSafeInteger(prefix[role+'Received'])&&prefix[role+'Received']>=0&&prefix[role+'Received']<=t.readState[role+'Received'])||prefix.buyerReceived+prefix.sellerReceived!==event.sequence)return null;return productMessageFacts(m,t);},
  async readBlock(raw,from,to){if(!safeId(from)||!safeId(to)||from===to)return null;return get(raw,ref(c,'blocks',hash([from,to])));}
 });
 const migrationReaders=Object.freeze({
  assertCompatible(database,paths){if(database!==db||[...Object.values(c),...Object.values(m)].some(path=>paths.includes(path)))throw Error('Migration namespace/database conflict');},
  async readThread(raw,id){const t=await get(raw,ref(c,'threads',id));return t?.id===id&&t.id===hash([t.productId,t.buyerUid,t.sellerUid])&&t.inboxIndexed===true&&validReadState(t)&&await authority(raw,t,t.buyerUid,{checkBlocks:false,checkIndex:false})?{kind:'product',threadId:t.id,providerId:null,participants:[t.buyerUid,t.sellerUid],revision:t.revision,readState:t.readState}:null;},
  messageRef:(id,n)=>ref(c,'messages',hash([id,n])),async readBlock(raw,from,to){const v=await notificationReaders.readBlock(raw,from,to);if(!v)return null;const {committedAt,...facts}=v;return facts;}
 });
 return Object.freeze({notificationReaders,migrationReaders,changeVisibility:(r,o)=>legacyMutation('visibility',r,o),changeBlock:(r,o)=>legacyMutation('block',r,o),open:(r,o)=>mutate('open',r,o),send:(r,o)=>mutate('send',r,o),
  async read(request,options){const input=copyRecord(request,['threadId','expectedRevision','afterSequence','limit']);if(!input||!safeId(input.threadId)||!revision(input.expectedRevision)||!Number.isInteger(input.afterSequence)||input.afterSequence<0||input.afterSequence>=input.expectedRevision||!Number.isInteger(input.limit)||input.limit<1||input.limit>20)return fail('INVALID_REQUEST');
   return bounded(options,async context=>{const result=await sdk.runTransaction(db,async raw=>{check(context);const thread=await get(raw,ref(c,'threads',input.threadId));if(!await authority(raw,thread,context.actorUid,{allowReconciled:reconciledHistoryEnabled}))return fail('DENIED');if(thread.revision!==input.expectedRevision)return fail('REVISION_CONFLICT');if(readStateEnabled&&!validReadState(thread))return fail('READ_STATE_UNAVAILABLE');const row=await reconciledRow(raw,thread,context.actorUid);if(row)return readReconciled(raw,thread,row,input,context);const messages=[];let delivery=null,incomingBefore=0;if(readStateEnabled&&input.afterSequence>0){const anchor=await get(raw,ref(c,'messages',hash([thread.id,input.afterSequence]))),prefix=copyRecord(anchor?.readPrefix,['buyerReceived','sellerReceived']);if(anchor?.threadId!==thread.id||anchor.sequence!==input.afterSequence||!prefix||!['buyer','seller'].every(role=>Number.isSafeInteger(prefix[role+'Received'])&&prefix[role+'Received']>=0&&prefix[role+'Received']<=thread.readState[role+'Received'])||prefix.buyerReceived+prefix.sellerReceived!==input.afterSequence)return fail('READ_STATE_UNAVAILABLE');incomingBefore=prefix[roleOf(thread,context.actorUid)+'Received'];}
    for(let n=input.afterSequence+1;n<=Math.min(thread.messageCount,input.afterSequence+input.limit);n++){const msg=await get(raw,ref(c,'messages',hash([thread.id,n])));if(!productMessageVisible(msg,thread,context.actorUid))return fail('READ_STATE_UNAVAILABLE');if(msg?.threadId!==thread.id||msg.sequence!==n||![thread.buyerUid,thread.sellerUid].includes(msg.senderUid)||normalizeMessageDraft(msg.text)!==msg.text)return fail('UNAVAILABLE');if(readStateEnabled){const prefix=copyRecord(msg.readPrefix,['buyerReceived','sellerReceived']);if(!prefix||!['buyer','seller'].every(role=>Number.isSafeInteger(prefix[role+'Received'])&&prefix[role+'Received']>=0&&prefix[role+'Received']<=thread.readState[role+'Received'])||prefix.buyerReceived+prefix.sellerReceived!==n)return fail('READ_STATE_UNAVAILABLE');delivery={scope:deliveryScope(thread,context.actorUid),afterSequence:input.afterSequence,incomingBefore,throughSequence:n,incomingCount:prefix[roleOf(thread,context.actorUid)+'Received']};}messages.push({sequence:n,senderRole:msg.senderUid===thread.buyerUid?'buyer':'seller',text:msg.text});}check(context);return {ok:true,thread:dto(thread,context.actorUid),messages,hasMore:input.afterSequence+messages.length<thread.messageCount,...(readStateEnabled?{delivery}:{} )};},{maxAttempts:3});
    if(!readStateEnabled||!result.ok)return result;const {delivery,...response}=result;const readReceipt=delivery?await issueCursor(delivery):null;check(context);if(readReceipt!==null&&(typeof readReceipt!=='string'||readReceipt.length<1||readReceipt.length>1024))return fail('UNAVAILABLE');return {...response,readReceipt};
   });
  },
  async summary(request,options){if(!readStateEnabled)return fail('UNAVAILABLE');const input=copyRecord(request,['threadId']);if(!input||!safeId(input.threadId))return fail('INVALID_REQUEST');return bounded(options,context=>sdk.runTransaction(db,async raw=>{check(context);const thread=await get(raw,ref(c,'threads',input.threadId));if(!await authority(raw,thread,context.actorUid))return fail('DENIED');if(!validReadState(thread))return fail('READ_STATE_UNAVAILABLE');const role=roleOf(thread,context.actorUid),r=thread.readState,last=await get(raw,ref(c,'messages',hash([thread.id,thread.revision])));if(!productMessageVisible(last,thread,context.actorUid)||last.sequence!==thread.revision||last.senderUid!==r.lastSenderUid||last.text.slice(0,160)!==r.lastPreview)return fail('READ_STATE_UNAVAILABLE');const value=validateInboxSummary({chatId:thread.id,participantUids:[thread.buyerUid,thread.sellerUid],unreadCount:r[role+'Received']-r[role+'ReadCount'],lastMessageSenderUid:r.lastSenderUid,lastMessagePreview:r.lastPreview,lastMessageAtMillis:r.lastMessageAtMillis,schemaVersion:1},context.actorUid);check(context);return value.ok?{ok:true,summary:value.value,readSequence:r[role+'ReadSequence'],lastSequence:thread.revision}:fail('READ_STATE_UNAVAILABLE');},{maxAttempts:3}));},
  async acknowledge(request,options){if(!readStateEnabled)return fail('UNAVAILABLE');const input=copyRecord(request,['threadId','readReceipt']);if(!input||!safeId(input.threadId)||typeof input.readReceipt!=='string'||input.readReceipt.length<1||input.readReceipt.length>1024)return fail('INVALID_REQUEST');return bounded(options,async context=>{const decoded=await readCursor(input.readReceipt);if(Object.hasOwn(decoded??{},'visibleIncoming'))return acknowledgeReconciled(input,decoded,context);const proof=copyRecord(decoded,['scope','afterSequence','incomingBefore','throughSequence','incomingCount']);check(context);if(!proof||!Number.isSafeInteger(proof.afterSequence)||proof.afterSequence<0||!Number.isSafeInteger(proof.incomingBefore)||proof.incomingBefore<0||proof.incomingBefore>proof.afterSequence||proof.incomingBefore>proof.incomingCount||proof.afterSequence>=proof.throughSequence||!Number.isSafeInteger(proof.throughSequence)||proof.throughSequence<1||!Number.isSafeInteger(proof.incomingCount)||proof.incomingCount<0)return fail('INVALID_READ_RECEIPT');context.markMutationAttempted();return sdk.runTransaction(db,async raw=>{check(context);const thread=await get(raw,ref(c,'threads',input.threadId));if(!await authority(raw,thread,context.actorUid))return fail('DENIED');if(thread.inboxIndexed===true&&!inboxIndex)return fail('INDEX_REQUIRED');if(!validReadState(thread))return fail('READ_STATE_UNAVAILABLE');const role=roleOf(thread,context.actorUid),r=thread.readState;if(proof.scope!==deliveryScope(thread,context.actorUid)||proof.throughSequence>thread.revision||proof.incomingCount>r[role+'Received']||proof.incomingCount>proof.throughSequence)return fail('INVALID_READ_RECEIPT');if(proof.throughSequence<=r[role+'ReadSequence'])return proof.incomingCount<=r[role+'ReadCount']?{ok:true,status:'unchanged',readSequence:r[role+'ReadSequence']}:fail('INVALID_READ_RECEIPT');if(proof.incomingBefore>r[role+'ReadCount'])return fail('READ_GAP');if(proof.incomingCount<r[role+'ReadCount'])return fail('INVALID_READ_RECEIPT');const key=hash(['product-read-ack-v1',context.actorUid,thread.id,proof.throughSequence]),receipt=await get(raw,ref(c,'receipts',key)),audit=await get(raw,ref(c,'audits',key));if(receipt||audit)return fail('READ_STATE_UNAVAILABLE');const next={...r,[role+'ReadSequence']:advanceReadCursor(r[role+'ReadSequence'],proof.throughSequence).sequence,[role+'ReadCount']:proof.incomingCount},record={actorUid:context.actorUid,threadId:thread.id,readSequence:proof.throughSequence,incomingCount:proof.incomingCount};const indexCommit=inboxIndex?await inboxIndex.stageConversation(raw,{kind:'product',before:thread,after:{...thread,readState:next},title:(await get(raw,ref(m,'publicViews','product_'+thread.productId))).title.slice(0,160)}):null;check(context);raw.set(ref(c,'threads',thread.id),{...thread,readState:next});raw.set(ref(c,'receipts',key),record);raw.set(ref(c,'audits',key),{...record,requestKey:key,operation:'read.acknowledge'});indexCommit?.();check(context);return {ok:true,status:'advanced',readSequence:proof.throughSequence};},{maxAttempts:3});});},
  inboxSummaries:(request,options)=>readInbox(request,options,true,true),
  inbox:(request,options)=>readInbox(request,options,false),inboxPage:(request,options)=>readInbox(request,options,true),
  async thread(request,options){const input=copyRecord(request,['threadId']);if(!input||!safeId(input.threadId))return fail('INVALID_REQUEST');return bounded(options,context=>sdk.runTransaction(db,async raw=>{check(context);const value=await get(raw,ref(c,'threads',input.threadId));if(value?.id!==input.threadId||!await authority(raw,value,context.actorUid,{allowReconciled:reconciledHistoryEnabled}))return fail('DENIED');check(context);return {ok:true,thread:dto(value,context.actorUid)};},{maxAttempts:3}));}

 });
}
