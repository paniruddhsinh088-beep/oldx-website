import {createBoundedRead} from '../shared/bounded-read.mjs';
export const PHOTO_LIMITS=Object.freeze({product:Object.freeze({count:6,bytes:3*1024*1024}),store:Object.freeze({count:1,bytes:3*1024*1024}),provider:Object.freeze({count:1,bytes:2*1024*1024})});
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export const isManagedPhoto=v=>{try{return v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')==='imageId,kind'&&['kind','imageId'].every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'))&&v.kind==='managed'&&/^[A-Za-z0-9_-]{20,80}$/.test(v.imageId);}catch{return false;}};
const typeOf=b=>b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)?'image/png':b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'?'image/webp':null;
// Local selection/progress only. It cannot prove decoding, ownership, moderation
// or public release. Those are independently enforced by the injected server.
export function createMandatoryPhotos({enabled=false,kind,upload,makeRequestId=()=>globalThis.crypto.randomUUID(),createPreview=()=>null,revokePreview=()=>{},onChange=()=>{},timeoutMs=10000}={}){
 const policy=PHOTO_LIMITS[kind];let scope=null,online=true,changed=false,epoch=0,items=[],error=null,sequence=0,selectionVersion=0;
 const snapshot=()=>({enabled:enabled===true,online,changed,status:error??(items.some(i=>i.status==='uploading')?'uploading':items.length?'selected':'empty'),items:items.map(({key,preview,status,progress,imageId})=>({key,preview,status,progress,imageId})),ready:items.length>0&&items.every(i=>i.status==='uploaded')});
 const emit=()=>onChange(snapshot());
 function dispose(item){item.reader?.clear();if(item.preview)revokePreview(item.preview);}
 const clear=()=>{selectionVersion++;epoch++;for(const item of items)dispose(item);items=[];changed=false;error=null;emit();};
 function sameScope(value){return JSON.stringify(scope)===JSON.stringify(value);}
 async function select(files){
  if(!enabled||!policy||!scope)return false;const selected=Array.from(files??[]);if(selected.length<1||items.length+selected.length>policy.count){error='limit';emit();return false;}
  const version=epoch,selection=++selectionVersion,staged=[];
  try{for(const file of selected){if(!file||typeof file.arrayBuffer!=='function'||!['image/jpeg','image/png','image/webp'].includes(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>policy.bytes)throw new Error('Invalid file');const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size||typeOf(bytes)!==file.type)throw new Error('Invalid signature');if(version!==epoch||selection!==selectionVersion)return false;staged.push({key:'photo-'+(++sequence),bytes,contentType:file.type,preview:null,status:'selected',progress:0,imageId:null,requestId:null,reader:null,file});}
   if(version!==epoch||selection!==selectionVersion||items.length+staged.length>policy.count)return false;for(const item of staged){item.preview=createPreview(item.file);delete item.file;}items.push(...staged);changed=true;error=null;emit();return true;
  }catch{for(const item of staged)dispose(item);if(version===epoch){error='invalid';emit();}return false;}
 }
 async function send(key){
  const item=items.find(i=>i.key===key);if(!online){error='offline';emit();return false;}if(!enabled||!scope||!item||['uploading','uploaded'].includes(item.status)||typeof upload!=='function')return false;
  if(!item.requestId){try{item.requestId=makeRequestId();}catch{}if(!id(item.requestId)){error='unavailable';emit();return false;}}
  const version=epoch,parent={...scope};item.reader?.clear();item.reader=createBoundedRead({timeoutMs,read:(_,context)=>upload({requestId:item.requestId,kind,parentId:parent.parentId,expectedParentRevision:parent.revision,contentType:item.contentType,bytes:new Uint8Array(item.bytes)},{...context,onProgress:percent=>{if(version===epoch&&items.includes(item)&&Number.isFinite(percent)){item.progress=Math.max(item.progress,Math.min(99,Math.max(0,percent)));emit();}}}),project:r=>{if(!r||Object.getPrototypeOf(r)!==Object.prototype||Reflect.ownKeys(r).sort().join(',')!=='imageId,ok,state')return null;const fields=Object.getOwnPropertyDescriptors(r);if(['ok','state','imageId'].some(k=>!Object.hasOwn(fields[k],'value')))return null;const v=Object.fromEntries(Object.entries(fields).map(([k,d])=>[k,d.value]));if(v.ok!==true||v.state!=='quarantined'||!isManagedPhoto({kind:'managed',imageId:v.imageId}))return null;return {imageId:v.imageId};},onChange:state=>{if(version!==epoch||!items.includes(item)||state.status==='idle')return;if(state.status==='loading')item.status='uploading';else if(state.status==='ready'){item.status='uploaded';item.progress=100;item.imageId=state.snapshot.imageId;}else item.status='retry';error=null;emit();}});await item.reader.load({});return item.status==='uploaded';
 }
 emit();return Object.freeze({snapshot,select,upload:send,retry:send,clear,setOnline(value){online=value===true;if(!online){epoch++;selectionVersion++;for(const item of items){item.reader?.clear();if(item.status==='uploading')item.status='retry';}error='offline';}else error=null;emit();},
  setScope(value){const next=value&&id(value.uid)&&id(value.sessionId)&&id(value.parentId)&&Number.isSafeInteger(value.revision)&&value.revision>=0?{uid:value.uid,sessionId:value.sessionId,parentId:value.parentId,revision:value.revision}:null;if(!sameScope(next)){clear();scope=next;}},
  remove(key){const index=items.findIndex(i=>i.key===key);if(index<0)return false;dispose(items[index]);items.splice(index,1);changed=true;error=null;emit();return true;},
  references(){return items.filter(i=>i.status==='uploaded').map(i=>({kind:'managed',imageId:i.imageId}));}
 });
}
