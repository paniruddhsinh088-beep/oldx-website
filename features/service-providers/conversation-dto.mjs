import {normalizeMessageDraft} from '../chat/message-text.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),int=v=>Number.isSafeInteger(v)&&v>=0&&v<10000;
const exact=(v,keys)=>{try{return v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',')&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));}catch{return false;}};
export function projectServiceConversation(operation,r){try{
 if(!exact(r,operation==='read'?['ok','thread','messages','hasMore']:['ok','status','thread'])||r.ok!==true)return null;
 const t=r.thread;if(!exact(t,['providerId','enquiryId','service','revision','enquiryRevision','generation','role','canSend'])||!id(t.providerId)||!id(t.enquiryId)||typeof t.service!=='string'||t.service.length<1||t.service.length>80||!int(t.revision)||!int(t.enquiryRevision)||!Number.isSafeInteger(t.generation)||t.generation<1||!['buyer','provider'].includes(t.role)||typeof t.canSend!=='boolean')return null;
 if(operation==='read'){if(typeof r.hasMore!=='boolean'||!Array.isArray(r.messages)||r.messages.length>20)return null;let previous=0;for(const m of r.messages){if(!exact(m,['sequence','role','text'])||!int(m.sequence)||m.sequence<1||m.sequence<=previous||m.sequence>t.revision||!['buyer','provider'].includes(m.role)||normalizeMessageDraft(m.text)===null)return null;previous=m.sequence;}}
 else if(operation!=='send'||!['sent','replayed'].includes(r.status)||t.revision<1)return null;
 return structuredClone(r);
}catch{return null;}}
// Opt-in sparse pages preserve physical cursor progress without exposing hidden text.
export function projectServiceConversationRead(r,{reconciled=false}={}){try{if(!Object.hasOwn(r??{},'throughSequence'))return projectServiceConversation('read',r);if(reconciled!==true||!exact(r,['ok','thread','messages','hasMore','throughSequence']))return null;const {throughSequence,...base}=r,p=projectServiceConversation('read',base);return p&&int(throughSequence)&&throughSequence<=p.thread.revision&&p.messages.every(m=>m.sequence<=throughSequence)&&p.hasMore===(throughSequence<p.thread.revision)?{...p,throughSequence}:null;}catch{return null;}}
