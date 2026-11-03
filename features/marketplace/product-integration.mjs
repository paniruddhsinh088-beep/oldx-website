import {createBoundedRead} from '../shared/bounded-read.mjs';
import {normalizeMessageDraft} from '../chat/message-text.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),rev=v=>Number.isSafeInteger(v)&&v>0;
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',');
const publicKeys=['id','kind','revision','title','description','category','locationLabel','basePrice','isSold','storeId'];
export function projectProduct(value){if(!exact(value,publicKeys)||!id(value.id)||value.kind!=='product'||!rev(value.revision)||!['title','description','category','locationLabel'].every(k=>typeof value[k]==='string'&&value[k].length>0&&value[k].length<=5000)||!Number.isFinite(value.basePrice)||value.basePrice<0||value.basePrice>1e9||typeof value.isSold!=='boolean'||value.storeId!==null&&!id(value.storeId))return null;return Object.freeze({...value});}
const thread=v=>exact(v,['id','productId','productRevision','revision','role'])&&id(v.id)&&id(v.productId)&&rev(v.productRevision)&&rev(v.revision)&&['buyer','seller'].includes(v.role)?{...v}:null;
// Session is a cancellation scope only. All ownership/authentication is enforced
// by injected trusted ports. No Firebase, fetch, storage, credentials or globals.
export function createProductIntegration({enabled=false,ports={},onChange=()=>{},onPrivate=()=>{},makeRequestId=()=>globalThis.crypto.randomUUID(),timeoutMs=5000}={}){
 let session=null,online=true,epoch=0,pending=null,commandRead=null,command={status:enabled?'idle':'disabled',canRetry:false},owner=null,detail=null,items=[],nextCursor=null,lastCategory='',inbox=[],privateThread=null;
 const readers=new Map(),statuses={};
 const snapshot=()=>structuredClone({command,owner,detail,items,nextCursor,authenticated:!!session,inbox,thread:privateThread,statuses});
 const emit=()=>onChange(snapshot());
 function clearReads(){for(const r of readers.values())r.clear();readers.clear();items=[];nextCursor=null;detail=null;inbox=[];privateThread=null;onPrivate(null);for(const k of Object.keys(statuses))delete statuses[k];}
 function invalidate({logout=false}={}){epoch++;commandRead?.clear();commandRead=null;clearReads();if(logout){pending=null;owner=null;}command={status:pending?'unknown':enabled?'idle':'disabled',canRetry:!!pending};emit();}
 async function load(channel,request,project){
  if(!enabled||!online||typeof ports[channel]!=='function')return;readers.get(channel)?.clear();const version=epoch;
  const reader=createBoundedRead({timeoutMs,read:(r,context)=>ports[channel](r,{...context,session:session&&{...session}}),project,onChange:state=>{if(version!==epoch)return;statuses[channel]=state.status;
   if(channel==='list'){items=state.status==='ready'?state.snapshot.items:[];nextCursor=state.status==='ready'?state.snapshot.nextCursor:null;}
   if(channel==='detail'){detail=state.status==='ready'?state.snapshot.profile:null;privateThread=null;onPrivate(null);}
   if(channel==='inbox')inbox=state.status==='ready'?state.snapshot.items:[];
   if(channel==='read'){privateThread=state.status==='ready'?state.snapshot.thread:null;onPrivate(state.status==='ready'?state.snapshot:null);}
   emit();}});readers.set(channel,reader);return reader.load(request);
 }
 async function dispatch(){
  if(!pending||!session||!online||!enabled||command.status==='loading')return;const envelope=pending,version=epoch;const identity={...session};
  commandRead=createBoundedRead({timeoutMs,read:(_,context)=>{envelope.dispatched=true;return ports[envelope.operation](structuredClone(envelope.body),{...context,session:identity});},project:r=>r&&typeof r.ok==='boolean'?r:null,onChange:state=>{
   if(version!==epoch||pending!==envelope)return;if(state.status==='loading'){command={status:'loading',canRetry:false};emit();return;}if(state.status==='idle')return;
   const result=state.snapshot;if(state.status!=='ready'||result?.code==='OUTCOME_UNKNOWN'){command={status:'unknown',canRetry:true};emit();return;}
   if(result.ok){let valid=false;if(envelope.operation==='save'||envelope.operation==='archive'){valid=id(result.id)&&rev(result.revision);if(valid){owner={id:result.id,revision:result.revision};if(envelope.operation==='archive'||envelope.body.publication!=='draft')clearReads();}}
    else {const t=thread(result.thread);valid=!!t;if(valid){privateThread=t;}}
    if(!valid){command={status:'unknown',canRetry:true};emit();return;}pending=null;command={status:'saved',canRetry:false};
   }else{pending=null;command={status:result.code==='DENIED'||result.code==='AUTH_REQUIRED'?'denied':result.code==='REVISION_CONFLICT'?'conflict':'unavailable',canRetry:false};onPrivate(null);privateThread=null;}
   emit();}});return commandRead.load({});
 }
 function write(operation,body){if(enabled&&!session){command={status:'denied',canRetry:false};emit();return Promise.resolve();}if(!enabled||!session||!online||pending||typeof ports[operation]!=='function')return Promise.resolve();let key;try{key=makeRequestId();}catch{return Promise.resolve();}if(!id(key))return Promise.resolve();pending={operation,body:{...structuredClone(body),requestId:key},dispatched:false};return dispatch();}
 return Object.freeze({snapshot,
  setSession(value){const next=value&&id(value.uid)&&id(value.sessionId)?{uid:value.uid,sessionId:value.sessionId}:null;if(JSON.stringify(next)!==JSON.stringify(session)){invalidate({logout:true});session=next;emit();}},
  changeScope(){invalidate();},setOnline(value){online=value===true;if(!online)invalidate();},clear(){invalidate({logout:true});session=null;},retry:()=>dispatch(),
  save(profile,publication='draft'){if(!['draft','publish','withdraw'].includes(publication))return Promise.resolve();return write('save',{id:owner?.id??null,expectedRevision:owner?.revision??0,publication,profile});},
  archive(){return owner?write('archive',{id:owner.id,expectedRevision:owner.revision}):Promise.resolve();},
  nextPage(){return nextCursor?this.discover({category:lastCategory,cursor:nextCursor}):Promise.resolve();},
  discover({category='',cursor=null}={}){lastCategory=category;readers.get('detail')?.clear();readers.get('read')?.clear();detail=null;privateThread=null;onPrivate(null);return load('list',{kind:'product',limit:12,category,storeId:null,cursor},r=>{if(!r?.ok||!Array.isArray(r.items)||r.items.length>12||r.nextCursor!==null&&(typeof r.nextCursor!=='string'||r.nextCursor.length>1024))return null;const values=r.items.map(projectProduct);return values.every(Boolean)?{items:values,nextCursor:r.nextCursor}:null;});},
  openProduct(productId){readers.get('read')?.clear();if(!id(productId))return Promise.resolve();return load('detail',{kind:'product',id:productId},r=>{const p=projectProduct(r?.profile);return r?.ok===true&&p?.id===productId?{profile:p}:null;});},
  enquire(text){const normalized=normalizeMessageDraft(text);return detail&&normalized?write('open',{productId:detail.id,expectedProductRevision:detail.revision,text:normalized}):Promise.resolve();},
  reply(text){const normalized=normalizeMessageDraft(text);return privateThread&&normalized?write('send',{threadId:privateThread.id,expectedRevision:privateThread.revision,text:normalized}):Promise.resolve();},
  loadInbox(role='seller'){return session&&['buyer','seller'].includes(role)?load('inbox',{role,limit:20},r=>{if(!r?.ok||!Array.isArray(r.items)||r.items.length>20)return null;const items=r.items.map(thread);return items.every(Boolean)&&items.every(t=>t.role===role)?{items}:null;}):Promise.resolve();},
  loadThread(value){const t=thread(value);if(!session||!t)return Promise.resolve();return load('read',{threadId:t.id,expectedRevision:t.revision,afterSequence:0,limit:20},r=>{const current=thread(r?.thread);if(!r?.ok||!current||current.id!==t.id||current.productId!==t.productId||current.productRevision!==t.productRevision||current.revision!==t.revision||current.role!==t.role||!Array.isArray(r.messages)||r.messages.length>20||typeof r.hasMore!=='boolean')return null;let seq=0;for(const msg of r.messages){if(!exact(msg,['sequence','senderRole','text'])||msg.sequence!==++seq||msg.sequence>current.revision||!['buyer','seller'].includes(msg.senderRole)||normalizeMessageDraft(msg.text)!==msg.text)return null;}return {thread:current,messages:structuredClone(r.messages),hasMore:r.hasMore};});}
 });
}
