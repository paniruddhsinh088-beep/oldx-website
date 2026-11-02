import {demoProviders} from './preview-fixtures.mjs';
import {createPublicProviderRepository,DISCOVERY_FIELDS} from './provider-discovery.mjs';
export const sampleDiscoveryCatalog=Object.freeze({services:Object.freeze([...new Set(demoProviders.flatMap(p=>p.services))]),localities:Object.freeze(demoProviders.map(p=>Object.freeze({city:p.city,serviceArea:p.area})))});
// Only authored sample public records. Never full user/provider/private documents.
export function createSampleDiscoveryRepository({mode=()=> 'normal',withdrawn=()=>false}={}){
 const cursors=new Map();let sequence=0;
 let publicationEpoch=1,lastWithdrawal=withdrawn();
 const generation=()=>{const current=withdrawn();if(current!==lastWithdrawal){publicationEpoch++;lastWithdrawal=current;}return publicationEpoch;};
 return createPublicProviderRepository({enabled:true,catalog:sampleDiscoveryCatalog,getPublicationEpoch:generation,
  readCursor:token=>cursors.get(token)??null,
  issueCursor:state=>{const token='sample_cursor_'+(++sequence);cursors.set(token,{...state});if(cursors.size>32)cursors.delete(cursors.keys().next().value);return token;},
  query:(plan,{signal})=>new Promise((resolve,reject)=>{
   const selected=mode();let timer=null;
   function cleanup(){if(timer!==null)clearTimeout(timer);signal?.removeEventListener('abort',abort);}
   function abort(){cleanup();reject(new Error('Sample cancellation'));}
   if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});if(selected==='timeout')return;
   timer=setTimeout(()=>{cleanup();if(selected==='error'){reject(new Error('Sample failure'));return;}
    const rows=demoProviders.filter(p=>!withdrawn()||p.id!=='p1').map(p=>({id:p.id,displayName:p.name,city:p.city,serviceArea:p.area,services:[...p.services],available:p.available!==false,experienceYears:p.experience,description:p.about,languages:[],published:true,publicationEpoch:generation()}))
     .filter(p=>plan.where.every(([field,op,value])=>op==='array-contains'?p[field].includes(value):p[field]===value)&&(!plan.after||p.id>plan.after))
     .sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).slice(0,plan.limit).map(p=>Object.fromEntries(DISCOVERY_FIELDS.map(field=>[field,p[field]])));
    resolve({publicationEpoch:generation(),rows});
   },selected==='slow'?350:15);
  })
 });
}
