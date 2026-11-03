import {createBoundedRead} from '../shared/bounded-read.mjs';
import {projectServiceConversation} from './conversation-dto.mjs';
import {normalizeMessageDraft} from '../chat/message-text.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
// Message lifecycle only, not another enquiry state machine. No SDK, token,
// transport, private-text storage or auth grant. All ports are explicit and off.
export function createServiceConversationIntegration({enabled=false,execute,onChange=()=>{},onPrivate=()=>{},makeRequestId=()=>globalThis.crypto.randomUUID(),timeoutMs=5000}={}){
 let session=null,providerId=null,enquiryId=null,role='buyer',online=true,epoch=0,reader=null,command=null,pending=null,view=null,status=enabled?'idle':'disabled';
 const same=()=>pending&&pending.providerId===providerId&&pending.enquiryId===enquiryId;
 const snapshot=()=>({status,canRetry:!!(same()&&online),mutationBlocked:!!pending,selection:view?{enquiryId,revision:view.thread.revision,hasMore:view.hasMore}:null});
 const emit=()=>onChange(snapshot());
 const response=r=>r?.status?r.body?.ok?r.body:{ok:false,code:r.body?.error?.code}:r;
 function clearView(){view=null;onPrivate(null);}
 function invalidate(logout=false){epoch++;reader?.clear();command?.clear();clearView();enquiryId=null;if(logout){pending=null;session=null;providerId=null;}status=pending?'unknown':enabled?'idle':'disabled';emit();}
 async function read(after=0,expectedRevision=null){
  if(!enabled||!session||!online||!providerId||!enquiryId||typeof execute!=='function')return;
  clearView();const current=epoch,scope={providerId,enquiryId};
  reader?.clear();reader=createBoundedRead({timeoutMs,read:(_,ctx)=>execute('read',{...scope,expectedRevision,afterSequence:after,limit:20},{...ctx,session:{...session}}),project:r=>projectServiceConversation('read',response(r)),onChange:state=>{
   if(current!==epoch||state.status==='idle')return;status=state.status;
   if(state.status==='ready'){const v=state.snapshot,t=v.thread;let next=after;
    if(t.providerId!==scope.providerId||t.enquiryId!==scope.enquiryId||t.role!==role||expectedRevision!==null&&t.revision!==expectedRevision||v.messages.some(m=>m.sequence!==++next)||v.hasMore!==(next<t.revision)){status='unavailable';emit();return;}
    view=v;onPrivate(structuredClone(v));
   }emit();
  }});return reader.load({});
 }
 async function dispatch(){
  if(!enabled||!session||!online||!same()||status==='loading'||typeof execute!=='function')return;
  reader?.clear();const envelope=pending,current=epoch;command=createBoundedRead({timeoutMs,read:(_,ctx)=>execute('send',structuredClone(envelope),{...ctx,session:{...session}}),project:response,onChange:s=>{
   if(current!==epoch||pending!==envelope||s.status==='idle')return;if(s.status==='loading'){status='loading';emit();return;}
   const r=s.snapshot,v=projectServiceConversation('send',r);
   if(s.status!=='ready'||r?.code==='OUTCOME_UNKNOWN'||r?.ok&&!v){status='unknown';emit();return;}
   if(v){if(v.thread.providerId!==providerId||v.thread.enquiryId!==enquiryId||v.thread.revision!==envelope.expectedRevision+1||v.thread.role!==role){status='unknown';emit();return;}pending=null;clearView();status='saved';}
   else if(['INVALID_REQUEST','AUTH_REQUIRED','DENIED','REVISION_CONFLICT','IDEMPOTENCY_CONFLICT','RATE_LIMITED'].includes(r?.code)){pending=null;clearView();status=r.code==='REVISION_CONFLICT'?'conflict':'denied';}
   else {status='unknown';emit();return;}emit();
  }});return command.load({});
 }
 return Object.freeze({snapshot,clear:()=>invalidate(true),changeScope:()=>invalidate(),
  setSession(value){const next=value&&id(value.uid)&&id(value.sessionId)?{uid:value.uid,sessionId:value.sessionId}:null;if(JSON.stringify(session)!==JSON.stringify(next)){invalidate(true);session=next;}},
  select(value,audience='buyer'){invalidate();providerId=id(value)?value:null;role=['buyer','provider'].includes(audience)?audience:'buyer';},
  setOnline(value){online=value===true;if(!online){invalidate();status=pending?'unknown':'offline';emit();}},
  detail(value){if(enquiryId!==value)invalidate();if(!id(value)){invalidate();status='unavailable';emit();return Promise.resolve();}enquiryId=value;return read();},
  nextHistory(){return view?.hasMore?read(view.messages.at(-1).sequence,view.thread.revision):Promise.resolve();},
  send(text){if(!view?.thread.canSend||pending||status==='loading')return Promise.resolve();if(normalizeMessageDraft(text)===null){status='invalid';emit();return Promise.resolve();}let requestId;try{requestId=makeRequestId();}catch{}if(!id(requestId)){status='unavailable';emit();return Promise.resolve();}pending={providerId,enquiryId,expectedRevision:view.thread.revision,expectedEnquiryRevision:view.thread.enquiryRevision,expectedGeneration:view.thread.generation,requestId,text};return dispatch();},retry:dispatch
 });
}
