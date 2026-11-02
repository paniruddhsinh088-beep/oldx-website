import {normalizeProviderProfile} from './provider-profile.mjs';
import {buildPublicProviderProfile} from './provider-public-profile.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',');
// Private owner response validator only. Never a public profile projection.
export function validateOwnerBootstrapDto(value){try{
 if(!exact(value,['ok','schemaVersion','exists','providerId','revision','generation','published','publicationGeneration','capabilities','draft','receipt'])||value.ok!==true||value.schemaVersion!==1||typeof value.exists!=='boolean'||!integer(value.revision)||!integer(value.generation)||typeof value.published!=='boolean'||!integer(value.publicationGeneration)||value.publicationGeneration>value.generation||value.published&&value.publicationGeneration===0)return null;
 const c=value.capabilities;if(!exact(c,['canSaveDraft','canPublish','canWithdraw'])||Object.values(c).some(v=>typeof v!=='boolean')||c.canWithdraw&&!value.published)return null;
 let draft=null;
 if(value.exists){if(!id(value.providerId)||!exact(value.draft,['displayName','city','serviceArea','services','description','experienceYears','available','languages']))return null;const normalized=normalizeProviderProfile(value.draft),publicCheck=buildPublicProviderProfile({id:value.providerId,...value.draft});if(!normalized.ok||!publicCheck.ok)return null;draft=Object.freeze({...normalized.value,services:Object.freeze(normalized.value.services),languages:Object.freeze(normalized.value.languages)});}
 else if(value.providerId!==null||value.revision!==0||value.draft!==null||value.published||value.publicationGeneration!==0||c.canPublish||c.canWithdraw)return null;
 let receipt=null;
 if(value.receipt!==null){const r=value.receipt;if(!['draft.save','publication.manage'].includes(r.operation))return null;
  if(r.status==='unknown'){if(!exact(r,['operation','status']))return null;receipt={operation:r.operation,status:r.status};}
  else if(r.status==='committed'&&value.exists){const isDraft=r.operation==='draft.save';if(!exact(r,isDraft?['operation','status','revision']:['operation','status','generation','action'])||!integer(isDraft?r.revision:r.generation)||(isDraft?r.revision:r.generation)<1||(isDraft?r.revision>value.revision:r.generation>value.generation||!['publish','withdraw'].includes(r.action)))return null;receipt={...r};}else return null;
 }
 return Object.freeze({...value,capabilities:Object.freeze({...c}),draft,receipt:receipt?Object.freeze(receipt):null});
}catch{return null;}}
