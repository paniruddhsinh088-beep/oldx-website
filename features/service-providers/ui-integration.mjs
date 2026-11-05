import {validateOwnerBootstrapDto} from './owner-bootstrap-dto.mjs';
import {createBoundedRead} from '../shared/bounded-read.mjs';
import {normalizeProviderProfile} from './provider-profile.mjs';
import {buildPublicProviderProfile} from './provider-public-profile.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),number=v=>Number.isSafeInteger(v)&&v>=0;
const profileKeys=['id','displayName','city','serviceArea','services','available','experienceYears','description','languages'];
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',');
function publicProfile(value){if(!exact(value,profileKeys))return null;const checked=buildPublicProviderProfile(value);return checked.ok?Object.freeze({...checked.profile,services:Object.freeze(checked.profile.services),languages:Object.freeze(checked.profile.languages)}):null;}
// Default-disabled UI port. No token, endpoint, SDK, browser storage or identity
// authority. Session values are cancellation scopes, never server authorization.
export function createProviderUiIntegration({enabled=false,commands,reads,owner,onOwnerDraft=()=>{},onOwnerScope=()=>{},makeRequestId=()=>globalThis.crypto.randomUUID(),onChange=()=>{},timeoutMs=5000}={}){
 let session=null,revision=0,generation=0,scopeRevision=0,commandRevision=0,pending=null,commandRead=null,publicRead=null,online=true,ownerRead=null,ownerRevision=0,ownerState=Object.freeze({status:'idle'});
 let command=Object.freeze({status:enabled?'idle':'disabled',operation:null,canRetry:false}),publicState=Object.freeze({status:'idle'});
 const snapshot=()=>Object.freeze({command,public:publicState,owner:ownerState});const emit=()=>onChange(snapshot());
 const setCommand=(status,operation=pending?.operation??null,canRetry=!!pending)=>{command=Object.freeze({status,operation,canRetry});emit();};
 function cancelCommand(clear=false){commandRevision++;commandRead?.clear();commandRead=null;if(clear){pending=null;setCommand(enabled?'idle':'disabled',null,false);}else if(pending)setCommand(pending.dispatched?'unknown':'offline');}
 function cancelOwner(){ownerRevision++;ownerRead?.clear();ownerRead=null;ownerState=Object.freeze({status:'idle'});emit();}
 function clearPublic(){scopeRevision++;publicRead?.clear();publicRead=null;publicState=Object.freeze({status:'idle'});emit();}
 async function dispatch(){
  if(!enabled||!session||!pending||command.status==='loading'||ownerState.status==='loading')return snapshot();if(!online){setCommand('offline');return snapshot();}
  const envelope=pending,version=++commandRevision,sessionScope={uid:session.uid,sessionId:session.sessionId};
  commandRead?.clear();
  const read=createBoundedRead({timeoutMs,read:(_,context)=>{envelope.dispatched=true;return commands.execute(envelope.operation,structuredClone(envelope.body),{...context,session:sessionScope});},project:response=>response&&typeof response.status==='number'?response:null,onChange:state=>{
   if(version!==commandRevision||pending!==envelope)return;
   if(state.status==='loading'){setCommand('loading');return;}
   if(state.status==='idle')return;
   if(state.status!=='ready'){setCommand('unknown');return;}
   const response=state.snapshot,body=response.body;
   if(response.status===200){
    const draft=envelope.operation==='draft.save',keys=draft?['ok','status','providerId','revision']:['ok','status','providerId','action','generation'];
    if(!exact(body,keys)||body.ok!==true||!id(body.providerId)||!(draft?['saved','replayed']:['applied','replayed']).includes(body.status)||!number(draft?body.revision:body.generation)||!draft&&body.action!==envelope.body.action){setCommand('unknown');return;}
    if(draft){revision=Math.max(revision,body.revision);onOwnerScope({providerId:body.providerId,revision,services:[...envelope.body.profile.services]});}else generation=Math.max(generation,body.generation);
    pending=null;setCommand(draft?'saved':envelope.body.action==='publish'?'published':'withdrawn',envelope.operation,false);return;
   }
   if(response.status===202){setCommand('unknown');return;}
   if([401,403,400,409].includes(response.status)){pending=null;setCommand(response.status===409?'conflict':response.status===400?'invalid':'denied',envelope.operation,false);return;}
   setCommand(response.status===429?'limited':'unavailable');
  }});commandRead=read;await read.load({});return snapshot();
 }
 async function begin(operation,profile){
  if(!enabled){setCommand('disabled',null,false);return snapshot();}
  if(!session){setCommand('denied',null,false);return snapshot();}
  if(ownerState.status==='loading')return snapshot();
  cancelOwner();
  if(pending){setCommand(command.status==='loading'?'loading':command.status);return snapshot();}
  if(typeof commands?.execute!=='function'){setCommand('unavailable',operation,false);return snapshot();}
  let input;
  if(operation==='draft.save'){const normalized=normalizeProviderProfile(profile);if(!normalized.ok){setCommand('invalid',operation,false);return snapshot();}input={expectedRevision:revision,profile:normalized.value};}
  else input={expectedRevision:revision,expectedGeneration:generation,action:operation==='publication.publish'?'publish':'withdraw'};
  let requestId;try{requestId=makeRequestId();}catch{requestId=null;}
  if(!id(requestId)){setCommand('unavailable',operation,false);return snapshot();}
  pending={operation:operation==='draft.save'?operation:'publication.manage',body:structuredClone({requestId,...input}),dispatched:false};return dispatch();
 }
 async function read(kind,request){
  cancelOwner();clearPublic();cancelCommand();if(!enabled)return snapshot();
  const input=Object.freeze({...request});const version=scopeRevision;if(!online){publicState=Object.freeze({status:'offline'});emit();return snapshot();}
  if(typeof reads?.[kind]!=='function'){publicState=Object.freeze({status:'unavailable'});emit();return snapshot();}
  const load=createBoundedRead({timeoutMs,read:(scope,context)=>reads[kind](scope,context),project:response=>{
   if(response?.ok===false&&['DENIED','AUTH_REQUIRED'].includes(response.code))return {denied:true};
   if(response?.ok!==true)return null;
   if(kind==='discover'){
    if(!exact(response,['ok','items','nextCursor','publicationEpoch'])||!Array.isArray(response.items)||response.items.length>24||!number(response.publicationEpoch)||response.nextCursor!==null&&(typeof response.nextCursor!=='string'||!/^[A-Za-z0-9_.-]{1,1024}$/.test(response.nextCursor)))return null;
    const items=response.items.map(publicProfile);if(items.some(p=>!p)||new Set(items.map(p=>p.id)).size!==items.length)return null;
    return Object.freeze({items:Object.freeze(items),nextCursor:response.nextCursor,publicationEpoch:response.publicationEpoch});
   }
   if(!exact(response,['ok','profile','publicationEpoch'])||!number(response.publicationEpoch))return null;const profile=publicProfile(response.profile);return profile&&profile.id===input.providerId?Object.freeze({profile,publicationEpoch:response.publicationEpoch}):null;
  },onChange:state=>{if(version!==scopeRevision)return;publicState=state.status==='ready'?Object.freeze({status:state.snapshot.denied?'denied':state.snapshot.items?.length===0?'empty':'ready',...state.snapshot}):Object.freeze({status:state.status==='error'?'unavailable':state.status==='unavailable'?'withdrawn':state.status});emit();}});
  publicRead=load;await load.load(input);return snapshot();
 }
 async function bootstrap({restoreDraft=false,operation=null,requestId=null}={}){
  if(!enabled||!session||command.status==='loading')return snapshot();
  cancelOwner();cancelCommand();const version=ownerRevision,request=pending?{operation:pending.operation,requestId:pending.body.requestId}:{operation,requestId};
  if(!online||typeof owner?.load!=='function'){ownerState=Object.freeze({status:online?'unavailable':'offline'});emit();return snapshot();}
  const contextSession={uid:session.uid,sessionId:session.sessionId};
  ownerRead=createBoundedRead({timeoutMs,read:(_,context)=>owner.load({...request},{...context,session:contextSession}),project:response=>response,onChange:state=>{
   if(version!==ownerRevision)return;
   if(state.status==='idle')return;
   if(state.status==='loading'){ownerState=Object.freeze({status:'loading'});emit();return;}
   const response=state.snapshot,body=response?.status===200?validateOwnerBootstrapDto(response.body):null;
   if(!body){ownerState=Object.freeze({status:[401,403].includes(response?.status)?'denied':'unavailable'});emit();return;}
   if(body.revision<revision||body.generation<generation||request.operation!==null&&body.receipt?.operation!==request.operation){ownerState=Object.freeze({status:'unavailable'});emit();return;}
   revision=body.revision;generation=body.generation;
   const unresolved=body.receipt?.status==='unknown';
   if(pending&&body.receipt?.status==='committed'){pending=null;setCommand('reconciled',request.operation,false);}
   ownerState=Object.freeze({status:unresolved?'unresolved':'ready',...body.capabilities});
   onOwnerScope(body.exists&&!unresolved?{providerId:body.providerId,revision,services:[...body.draft.services]}:null);
   if(restoreDraft&&!unresolved&&body.draft)onOwnerDraft(structuredClone(body.draft));emit();
  }});await ownerRead.load({});return snapshot();
 }
 const api=Object.freeze({snapshot,setSession(value){
  if(value!==null&&(!exact(value,['uid','sessionId','revision','generation'])||!id(value.uid)||!id(value.sessionId)||!number(value.revision)||!number(value.generation)))throw new TypeError('Invalid UI session scope');
  if(session&&value&&session.uid===value.uid&&session.sessionId===value.sessionId){revision=Math.max(revision,value.revision);generation=Math.max(generation,value.generation);return;}
  cancelOwner();cancelCommand(true);clearPublic();session=value?{...value}:null;revision=value?.revision??0;generation=value?.generation??0;emit();
 },changeScope(){cancelOwner();clearPublic();cancelCommand();},setOnline(value){online=value===true;if(!online){cancelOwner();clearPublic();cancelCommand();publicState=Object.freeze({status:'offline'});emit();}},clear(){cancelOwner();cancelCommand(true);clearPublic();session=null;revision=generation=0;},
 bootstrap,saveDraft:profile=>begin('draft.save',profile),publish:()=>begin('publication.publish'),withdraw:()=>begin('publication.withdraw'),retry:()=>dispatch(),discover:request=>read('discover',request),detail:request=>read('detail',request)});emit();return api;
}
