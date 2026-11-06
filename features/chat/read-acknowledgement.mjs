import {createBoundedRead} from '../shared/bounded-read.mjs';
export const unwrap=r=>Number.isInteger(r?.status)?r.body?.ok?r.body:{ok:false,code:r.body?.error?.code}:r;
export const validReadReceipt=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=1024;
// Session-owned, in-memory only. Retry the SAME signed delivery; never send counts.
export function createReadAcknowledgement({enabled=false,execute,onChange=()=>{},onAcknowledged=()=>{},timeoutMs=5000}={}){
 let pending=null,reader=null,epoch=0,status='idle',completed=null,completedScope=null,inflight=null,queued=[],acknowledgedThrough=0;
 const emit=()=>onChange({status,canRetry:status==='unknown',pending:!!pending,queueFull:queued.length>=20});
 async function retry(){if(enabled!==true||!pending||inflight||typeof execute!=='function')return inflight;const value=pending,current=epoch;status='loading';emit();
  reader=createBoundedRead({timeoutMs,read:(_,ctx)=>execute(structuredClone(value.body),ctx),project:unwrap,onChange:s=>{if(current!==epoch||s.status==='idle'||s.status==='loading')return;const r=s.snapshot;
   if(s.status==='ready'&&r?.ok===true&&['advanced','unchanged'].includes(r.status)&&Number.isSafeInteger(r.readSequence)&&r.readSequence>=value.through){completed=value.key;completedScope=value.scope;pending=null;acknowledgedThrough=r.readSequence;status='saved';onAcknowledged();}
   else if(['DENIED','AUTH_REQUIRED','READ_GAP','INVALID_READ_RECEIPT','READ_STATE_UNAVAILABLE'].includes(r?.code)){pending=null;queued=[];status='unavailable';}
   else status='unknown';emit();}});const task=reader.load({});inflight=task;try{await task;}finally{if(current===epoch){inflight=null;if(status==='saved'){while(queued.length&&queued[0].through<=acknowledgedThrough)queued.shift();if(queued.length){pending=queued.shift();return retry();}}}}
 }
 return Object.freeze({retry,snapshot:()=>({status,canRetry:status==='unknown',queueFull:queued.length>=20}),
  accept(body,through){if(enabled!==true||!validReadReceipt(body?.readReceipt)||body.readReceipt===null||!Number.isSafeInteger(through)||through<1)return Promise.resolve();const key=JSON.stringify(body);if(completed===key)return Promise.resolve();const {readReceipt,...identity}=body,scope=JSON.stringify(identity);if(scope===completedScope&&through<=acknowledgedThrough)return Promise.resolve();const value={body:structuredClone(body),through,key,scope};if(pending||inflight){const active=pending??{scope:completedScope,through:acknowledgedThrough};if(scope===active.scope&&through>(queued.at(-1)?.through??active.through)){if(queued.length>=20)return Promise.resolve({ok:false,code:'ACK_BACKPRESSURE'});queued.push(value);emit();}return inflight??Promise.resolve();}pending=value;return retry();},
  clear(){epoch++;reader?.clear();reader=null;inflight=null;pending=null;completed=null;completedScope=null;queued=[];acknowledgedThrough=0;status='idle';emit();}
 });
}
