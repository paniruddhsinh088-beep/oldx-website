import {createProviderPrivateIntegration} from './private-integration.mjs';
import {createBoundedRead} from '../shared/bounded-read.mjs';
import {inspectSampleEnquiry} from './preview-enquiry.mjs';
import {SAMPLE_ENQUIRY_STATES,isSampleReply} from './preview-inbox-model.mjs';
import {createProviderUiIntegration} from './ui-integration.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),int=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>{try{return v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',')&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));}catch{return false;}};
// Platform-neutral, inactive client state. No window/DOM/storage/URL/SDK or token
// handling. Session values cancel UI work; only injected server ports authorize.
export function createBuyerEnquiryIntegration({enabled=false,commands,reads,makeRequestId=()=>globalThis.crypto?.randomUUID(),onChange=()=>{},onPrivateDetail=()=>{},timeoutMs=5000}={}){
 let session=null,selection=null,pending=null,detail=null,read=null,version=0,online=true,status=enabled?'idle':'disabled';
 const same=()=>pending&&selection&&pending.body.providerId===selection.providerId;
 const snapshot=()=>Object.freeze({status,enquiryId:detail?.id??null,revision:detail?.revision??null,canRetry:!!(pending&&same()&&online)});
 const emit=()=>onChange(snapshot());
 function invalidate(){version++;read?.clear();read=null;detail=null;onPrivateDetail(null);}
 async function dispatch(){
  if(!enabled||!session||!pending||!same()||status==='loading')return snapshot();if(!online){status='offline';emit();return snapshot();}if(typeof commands?.execute!=='function'){status='unavailable';emit();return snapshot();}
  const envelope=pending,current=++version,scope={...session};read?.clear();
  read=createBoundedRead({timeoutMs,read:(_,context)=>commands.execute(envelope.operation,structuredClone(envelope.body),{...context,session:scope}),project:r=>r,onChange:state=>{
   if(current!==version||pending!==envelope||state.status==='idle')return;if(state.status==='loading'){status='loading';emit();return;}
   const response=state.snapshot,body=response?.body,create=envelope.operation==='enquiry.create';
   if(state.status!=='ready'||response?.status===202){status='unknown';emit();return;}
   if(response.status===200&&exact(body,create?['ok','status','enquiryId']:['ok','status','enquiryId','revision'])&&body.ok===true&&id(body.enquiryId)&&(create?['created','replayed']:['cancelled','replayed']).includes(body.status)&&(create||body.enquiryId===envelope.body.enquiryId&&int(body.revision)&&body.revision===envelope.body.expectedRevision+1)){
    detail={id:body.enquiryId,revision:create?0:body.revision};pending=null;status=create?'created':'cancelled';emit();return;
   }
   if([400,401,403,409].includes(response.status)){pending=null;status=response.status===409?'conflict':response.status===400?'invalid':'denied';}else status=response.status===200?'unknown':'unavailable';emit();
  }});await read.load({});return snapshot();
 }
 async function begin(operation,input){
  if(!enabled||!session||!selection){status=enabled?'denied':'disabled';emit();return snapshot();}if(pending||status==='loading')return snapshot();let body;
  if(operation==='enquiry.create'){const inspected=inspectSampleEnquiry({id:selection.providerId,services:selection.services},input);if(!inspected.ok){status='invalid';emit();return snapshot();}body={providerId:selection.providerId,expectedPublicationGeneration:selection.publicationGeneration,service:inspected.value.service,description:inspected.value.description,timing:inspected.value.timing};}
  else {if(!detail?.loaded){status='unavailable';emit();return snapshot();}body={providerId:selection.providerId,enquiryId:detail.id,expectedRevision:detail.revision};}
  let requestId;try{requestId=makeRequestId();}catch{}if(!id(requestId)){status='unavailable';emit();return snapshot();}invalidate();pending={operation,body:{requestId,...body}};return dispatch();
 }
 async function load(enquiryId,expectedRevision){
  if(!enabled||!session||!selection||pending||!id(enquiryId)||!int(expectedRevision))return snapshot();invalidate();const current=version,scope={...session},providerId=selection.providerId;
  if(!online||typeof reads?.enquiry!=='function'){status=online?'unavailable':'offline';emit();return snapshot();}
  read=createBoundedRead({timeoutMs,read:(_,context)=>reads.enquiry({providerId,enquiryId,expectedRevision},{...context,session:scope}),project:r=>r,onChange:state=>{
   if(current!==version||state.status==='idle')return;if(state.status==='loading'){status='loading';emit();return;}const r=state.snapshot,v=r?.value;
   if(state.status==='ready'&&exact(r,['ok','kind','revision','value'])&&r.ok===true&&r.kind==='enquiry'&&r.revision===expectedRevision&&exact(v,['id','providerId','service','status','note','reply'])&&v.id===enquiryId&&v.providerId===providerId&&selection.services.includes(v.service)&&SAMPLE_ENQUIRY_STATES.includes(v.status)&&typeof v.note==='string'&&v.note.length<=400&&isSampleReply(v.reply)&&inspectSampleEnquiry({id:providerId,services:selection.services},{service:v.service,description:v.note,timing:'flexible'}).ok){detail={id:enquiryId,revision:expectedRevision,loaded:true};status='ready';onPrivateDetail(structuredClone(v));}
   else {detail=null;status=r?.code==='DENIED'?'denied':'unavailable';onPrivateDetail(null);}emit();
  }});await read.load({});return snapshot();
 }
 const api=Object.freeze({snapshot,setSession(value){if(value!==null&&(!exact(value,['uid','sessionId'])||!id(value.uid)||!id(value.sessionId)))throw new TypeError('Invalid enquiry session');if(session&&value&&session.uid===value.uid&&session.sessionId===value.sessionId)return;invalidate();session=value?{...value}:null;pending=null;selection=null;status=enabled?'idle':'disabled';emit();},select(value){if(value!==null&&(!exact(value,['providerId','services','publicationGeneration'])||!id(value.providerId)||!int(value.publicationGeneration)||value.publicationGeneration<1||!Array.isArray(value.services)||value.services.length<1||value.services.length>12||value.services.some(s=>typeof s!=='string'||s.length<1||s.length>80)||new Set(value.services).size!==value.services.length))throw new TypeError('Invalid enquiry scope');invalidate();selection=value?structuredClone(value):null;status=pending?'unknown':enabled?'idle':'disabled';emit();},setOnline(value){online=value===true;if(!online){invalidate();status=pending?'unknown':'offline';emit();}else{if(status==='offline')status=pending?'unknown':'idle';emit();}},create:input=>begin('enquiry.create',input),cancel:()=>begin('enquiry.cancel'),load,retry:dispatch,clear(){invalidate();session=selection=pending=null;status=enabled?'idle':'disabled';emit();}});emit();return api;
}
// One session lifecycle for existing owner and buyer ports. All production/network
// bindings remain caller-injected and default off; no competing owner state model.
export function createProviderJourneyIntegration({buyer={},privateEnquiries={},...options}={}){
 const owner=createProviderUiIntegration(options),client=createBuyerEnquiryIntegration({...buyer,enabled:options.enabled===true});
 const inbox=createProviderPrivateIntegration({...privateEnquiries,enabled:options.enabled===true});
 return Object.freeze({owner,buyer:client,inbox,setSession(value){owner.setSession(value);client.setSession(value?{uid:value.uid,sessionId:value.sessionId}:null);inbox.setSession(value?{uid:value.uid,sessionId:value.sessionId}:null);},clear(){owner.clear();client.clear();inbox.clear();},setOnline(value){owner.setOnline(value);client.setOnline(value);inbox.setOnline(value);},changeScope(){owner.changeScope();client.select(null);inbox.changeScope();}});
}
