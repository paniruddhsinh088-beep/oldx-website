import {createBoundedRead} from '../shared/bounded-read.mjs';
import {unwrap} from './read-acknowledgement.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),token=v=>typeof v==='string'&&v.length>0&&v.length<=1024,n=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>{try{return v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',')&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));}catch{return false;}};
const key=r=>r.kind+':'+r.threadId;
// Must match the TRUSTED cross-kind index: unread first, newest, stable kind/id.
export const compareInboxRows=(a,b)=>Number(b.unreadCount>0)-Number(a.unreadCount>0)||b.lastMessageAtMillis-a.lastMessageAtMillis||(key(a)<key(b)?-1:key(a)>key(b)?1:0);
export function projectUnifiedInboxPage(value){try{
 if(!exact(value,['ok','items','nextCursor','snapshotId','totalUnread'])||value.ok!==true||!Array.isArray(value.items)||value.items.length>20||!token(value.snapshotId)||value.nextCursor!==null&&!token(value.nextCursor)||!n(value.totalUnread))return null;
 let previous=null;const seen=new Set();for(const r of value.items){if(!exact(r,['kind','threadId','providerId','title','preview','unreadCount','readSequence','lastSequence','lastMessageAtMillis'])||!['product','provider'].includes(r.kind)||!id(r.threadId)||(r.kind==='provider'?!id(r.providerId):r.providerId!==null)||typeof r.title!=='string'||r.title.length<1||r.title.length>160||typeof r.preview!=='string'||r.preview.length>160||!['unreadCount','readSequence','lastSequence','lastMessageAtMillis'].every(k=>n(r[k]))||r.unreadCount>r.lastSequence||r.readSequence>r.lastSequence||seen.has(key(r))||previous&&compareInboxRows(previous,r)>0)return null;seen.add(key(r));previous=r;}
 // Never sum a partial page to invent the global badge.
 if(value.items.reduce((sum,r)=>sum+r.unreadCount,0)>value.totalUnread||value.nextCursor!==null&&value.items.length!==20)return null;
 return structuredClone(value);
}catch{return null;}}
// One shared web/Capacitor UI, with no SDK/direct Firestore fallback. The host must
// supply a trusted globally sorted snapshot page + exact global total. Neither
// existing id-ordered Product pages nor a partial Provider list meets that contract.
export function createUnifiedInbox({enabled=false,loadPage,onChange=()=>{},timeoutMs=5000}={}){
 let online=true,session=null,epoch=0,page=null,reader=null,inflight=null,status=enabled===true?'idle':'disabled';
 const snapshot=()=>({status,authenticated:!!session,items:page?structuredClone(page.items):[],next:!!page?.nextCursor,totalUnread:page?.totalUnread??null});const emit=()=>onChange(snapshot());
 function clear(){epoch++;reader?.clear();reader=null;inflight=null;page=null;status=enabled===true?'idle':'disabled';emit();}
 async function load(next=false){if(enabled!==true||!online||!session||typeof loadPage!=='function'||inflight||next&&!page?.nextCursor)return inflight;const previous=next?page:null,current=epoch,identity={...session};page=null;status='loading';emit();
  reader=createBoundedRead({timeoutMs,read:(body,ctx)=>loadPage(body,{...ctx,session:identity}),project:r=>{const p=projectUnifiedInboxPage(unwrap(r));if(!p)return null;if(previous&&(p.snapshotId!==previous.snapshotId||p.totalUnread!==previous.totalUnread||p.items.some(r=>previous.items.some(old=>key(old)===key(r)))||previous.items.length&&p.items.length&&compareInboxRows(previous.items.at(-1),p.items[0])>0||p.nextCursor===previous.nextCursor))return null;return p;},onChange:s=>{if(current!==epoch||s.status==='idle'||s.status==='loading')return;status=s.status==='ready'?'ready':'unavailable';page=s.status==='ready'?s.snapshot:null;emit();}});
  const task=reader.load({limit:20,cursor:previous?.nextCursor??null,snapshotId:previous?.snapshotId??null});inflight=task;try{await task;}finally{if(current===epoch)inflight=null;}
 }
 return Object.freeze({snapshot,refresh:()=>load(),next:()=>load(true),clear,setSession(value){const next=value&&id(value.uid)&&id(value.sessionId)?{uid:value.uid,sessionId:value.sessionId}:null;if(JSON.stringify(next)!==JSON.stringify(session)){session=next;clear();}},setOnline(value){online=value===true;if(!online)clear();else return load();}});
}
