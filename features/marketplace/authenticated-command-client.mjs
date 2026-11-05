const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const failure=code=>({ok:false,code});
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',');
const errors=new Set(['AUTH_REQUIRED','DENIED','REVISION_CONFLICT','IDEMPOTENCY_CONFLICT','PHOTOS_REQUIRED','RATE_LIMITED','INVALID_REQUEST','ENFORCEMENT_UNAVAILABLE','UNAVAILABLE','OUTCOME_UNKNOWN','CANCELLED','DEADLINE_EXCEEDED','CONFLICT','RECEIPT_UNKNOWN']);
// Inject into existing Product/Store ports. No fetch, SDK, storage, route
// installation or implicit enablement. Identity remains enforced by the server.
export function createAuthenticatedMarketplaceCommands({enabled=false,kind='product',getToken,sendCommand}={}){
 async function invoke(operation,body,context={}){
  if(enabled!==true||!['product','store'].includes(kind)||typeof getToken!=='function'||typeof sendCommand!=='function')return failure('UNAVAILABLE');
  const session=context.session,signal=context.signal;
  if(!id(session?.uid)||!id(session?.sessionId)||signal?.aborted)return failure('AUTH_REQUIRED');
  // Clone before token acquisition: caller edits cannot change an in-flight retry.
  let input;try{input=structuredClone(body);}catch{return failure('INVALID_REQUEST');}
  const keys=operation==='save'?['id','expectedRevision','publication','profile','requestId']:operation==='archive'?['id','expectedRevision','requestId']:['kind','id','requestId'];
  if(!exact(input,keys)||operation==='owner'&&input.kind!==kind)return failure('INVALID_REQUEST');
  let dispatched=false;
  try{
   const identity=await getToken({...session},{signal});
   if(signal?.aborted)return failure('CANCELLED');
   if(identity?.uid!==session.uid||identity?.sessionId!==session.sessionId||typeof identity.token!=='string'||identity.token.length>8192||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(identity.token))return failure('AUTH_REQUIRED');
   dispatched=true;
   const result=await sendCommand(operation,{...input,kind},{credential:identity.token,signal});
   if(signal?.aborted)return failure(operation==='owner'?'CANCELLED':'OUTCOME_UNKNOWN');
   if(result?.status===202)return failure('OUTCOME_UNKNOWN');
   const value=result?.body;
   if(result?.status===200&&value?.ok===true){
    const expected=operation==='owner'?['ok','id','revision','profile','published','publicationRevision','receipt']:['ok','status','id','revision','generation'];
    if(exact(value,expected))return structuredClone(value);
    return failure(operation==='owner'?'UNAVAILABLE':'OUTCOME_UNKNOWN');
   }
   const code=value?.error?.code;
   return failure(errors.has(code)?code:operation==='owner'?'UNAVAILABLE':'OUTCOME_UNKNOWN');
  }catch{return failure(dispatched&&operation!=='owner'?'OUTCOME_UNKNOWN':signal?.aborted?'CANCELLED':'UNAVAILABLE');}
 }
 return Object.freeze(Object.fromEntries(['save','owner','archive'].map(op=>[op,(body,context)=>invoke(op,body,context)])));
}
