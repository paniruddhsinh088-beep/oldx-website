import {createBoundedRead} from '../shared/bounded-read.mjs';
export const unwrap=r=>Number.isInteger(r?.status)?r.body?.ok?r.body:{ok:false,code:r.body?.error?.code}:r;
export const validReadReceipt=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=1024;
// Session-owned, in-memory only. Retry the SAME signed delivery; never send counts.
export function createReadAcknowledgement({enabled=false,execute,onChange=()=>{},onAcknowledged=()=>{},timeoutMs=5000}={}){
 let pending=null,reader=null,epoch=0,status='idle',completed=null,inflight=null;
 const emit=()=>onChange({status,canRetry:status==='unknown',pending:!!pending});
 async function retry(){if(enabled!==true||!pending||inflight||typeof execute!=='function')return inflight;const value=pending,current=epoch;status='loading';emit();
  reader=createBoundedRead({timeoutMs,read:(_,ctx)=>execute(structuredClone(value.body),ctx),project:unwrap,onChange:s=>{if(current!==epoch||s.status==='idle'||s.status==='loading')return;const r=s.snapshot;
   if(s.status==='ready'&&r?.ok===true&&['advanced','unchanged'].includes(r.status)&&Number.isSafeInteger(r.readSequence)&&r.readSequence>=value.through){completed=value.key;pending=null;status='saved';onAcknowledged();}
   else if(['DENIED','AUTH_REQUIRED','READ_GAP','INVALID_READ_RECEIPT','READ_STATE_UNAVAILABLE'].includes(r?.code)){pending=null;status='unavailable';}
   else status='unknown';emit();}});const task=reader.load({});inflight=task;try{await task;}finally{if(current===epoch)inflight=null;}
 }
 return Object.freeze({retry,snapshot:()=>({status,canRetry:status==='unknown'}),
  accept(body,through){if(enabled!==true||pending||!validReadReceipt(body?.readReceipt)||body.readReceipt===null||!Number.isSafeInteger(through)||through<1)return Promise.resolve();const key=JSON.stringify(body);if(completed===key)return Promise.resolve();pending={body:structuredClone(body),through,key};return retry();},
  clear(){epoch++;reader?.clear();reader=null;inflight=null;pending=null;completed=null;status='idle';emit();}
 });
}
