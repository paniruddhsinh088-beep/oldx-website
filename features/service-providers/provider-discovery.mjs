import {createBoundedRead} from '../shared/bounded-read.mjs';
import {buildPublicProviderProfile} from './provider-public-profile.mjs';
import {normalizeServiceSelections} from './service-selections.mjs';
export const DISCOVERY_FIELDS=Object.freeze(['id','displayName','city','serviceArea','services','available','experienceYears','description','languages','published','publicationEpoch']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const epoch=v=>Number.isSafeInteger(v)&&v>=0;
const text=v=>typeof v==='string'&&v.length>0&&v.length<=120&&v===v.trim().normalize('NFC')&&!/[<>\u0000-\u001f\u007f-\u009f]/u.test(v);
function record(input,keys){
 try{if(!plain(input)||Reflect.ownKeys(input).sort().join(',')!==[...keys].sort().join(','))return null;const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;}catch{return null;}
}
const requestKeys=['category','locality','limit','cursor'];
export function planPublicProviderQuery(input,catalog,{publicationEpoch,after=null}={}){
 const r=record(input,requestKeys);
 if(!r||!validCatalog(catalog)||!epoch(publicationEpoch)||r.category!==''&&!catalog.services.includes(r.category)||r.locality!==''&&!catalog.localities.some(l=>l.serviceArea===r.locality)||
  !Number.isInteger(r.limit)||r.limit<1||r.limit>24||r.cursor!==null&&(typeof r.cursor!=='string'||!/^[A-Za-z0-9_.-]{1,1024}$/.test(r.cursor))||after!==null&&!id(after))return null;
 return Object.freeze({view:'public-provider-discovery-v1',fields:DISCOVERY_FIELDS,where:Object.freeze([
  Object.freeze(['published','==',true]),...(r.category?[Object.freeze(['services','array-contains',r.category])]:[]),...(r.locality?[Object.freeze(['serviceArea','==',r.locality])]:[])
 ]),orderBy:Object.freeze(['id','asc']),limit:r.limit+1,after,publicationEpoch});
}
function validCatalog(c){
 if(!plain(c)||!Array.isArray(c.services)||c.services.length<1||c.services.length>64)return false;
 const normalized=normalizeServiceSelections(c.services,{maxServices:64});
 return normalized.ok&&c.services.every((s,i)=>s===normalized.services[i])&&Array.isArray(c.localities)&&c.localities.length>0&&c.localities.length<=100&&
  c.localities.every(l=>plain(l)&&text(l.city)&&text(l.serviceArea))&&new Set(c.localities.map(l=>l.serviceArea)).size===c.localities.length;
}
const deny=()=>({ok:false,code:'DISCOVERY_UNAVAILABLE'});
// Default-disabled repository port. query must read only an approved public view;
// getPublicationEpoch must change with ANY public mutation/revocation. No SDK here.
// Cursor issuer/verifier is trusted server infrastructure, never client claims.
export function createPublicProviderRepository({enabled=false,catalog,getPublicationEpoch,query,readCursor,issueCursor,readCanonical}={}){
 const config=validCatalog(catalog)?{services:[...catalog.services],localities:catalog.localities.map(l=>({...l}))}:null;
 return Object.freeze({async discover(input,{signal}={}){
  if(enabled!==true||!config||![getPublicationEpoch,query,readCursor,issueCursor].every(f=>typeof f==='function'))return deny();
  try{
   const r=record(input,requestKeys);if(!r||signal?.aborted)return deny();
   // Reject invalid requests before touching repositories or cursor infrastructure.
   if(!planPublicProviderQuery(r,config,{publicationEpoch:0}))return deny();
   const generation=await getPublicationEpoch({signal});if(signal?.aborted||!epoch(generation))return deny();
   const scope=JSON.stringify(['public-provider-discovery-v1',r.category,r.locality,r.limit,'id:asc']);let after=null;
   if(r.cursor!==null){const c=record(await readCursor(r.cursor,{signal}),['scope','publicationEpoch','after']);if(!c||c.scope!==scope||c.publicationEpoch!==generation||!id(c.after))return deny();after=c.after;}
   const plan=planPublicProviderQuery(r,config,{publicationEpoch:generation,after});if(signal?.aborted)return deny();
   const response=record(await query(plan,{signal}),['publicationEpoch','rows']);
   if(signal?.aborted||!response||response.publicationEpoch!==generation||!Array.isArray(response.rows)||response.rows.length>plan.limit)return deny();
   const profiles=[];let previous=after;
   for(const raw of response.rows){
    const profile=projectPublicRow(raw,config,generation);
    if(!profile||previous!==null&&profile.id<=previous||r.category&&!profile.services.includes(r.category)||r.locality&&profile.serviceArea!==r.locality)return deny();
    previous=profile.id;profiles.push(profile);
   }
   if(signal?.aborted||await getPublicationEpoch({signal})!==generation||signal?.aborted)return deny();
   const items=profiles.slice(0,r.limit);let nextCursor=null;
   if(profiles.length>r.limit){nextCursor=await issueCursor(Object.freeze({scope,publicationEpoch:generation,after:items.at(-1).id}),{signal});if(typeof nextCursor!=='string'||!/^[A-Za-z0-9_.-]{1,1024}$/.test(nextCursor))return deny();}
   if(signal?.aborted||await getPublicationEpoch({signal})!==generation||signal?.aborted)return deny();
   return Object.freeze({ok:true,items:Object.freeze(items),nextCursor,publicationEpoch:generation});
  }catch{return deny();}
 },async detail(input,{signal}={}){
  if(enabled!==true||!config||![getPublicationEpoch,query,readCanonical].every(f=>typeof f==='function'))return deny();
  try{
   const r=record(input,['providerId','expectedGeneration']);
   if(!r||!id(r.providerId)||r.expectedGeneration!==null&&!epoch(r.expectedGeneration)||signal?.aborted)return deny();
   const generation=await getPublicationEpoch({signal});
   if(!epoch(generation)||r.expectedGeneration!==null&&generation!==r.expectedGeneration||signal?.aborted)return deny();
   const canonical=record(await readCanonical(r.providerId,{signal}),['providerId','services','published','publicationEpoch']);
   if(!validCanonical(canonical,r.providerId,generation,config)||signal?.aborted)return deny();
   canonical.services=Object.freeze([...canonical.services]);
   const plan=Object.freeze({view:'public-provider-discovery-v1',fields:DISCOVERY_FIELDS,where:Object.freeze([Object.freeze(['id','==',r.providerId]),Object.freeze(['published','==',true])]),orderBy:Object.freeze(['id','asc']),limit:1,after:null,publicationEpoch:generation});
   const response=record(await query(plan,{signal}),['publicationEpoch','rows']);
   if(signal?.aborted||!response||response.publicationEpoch!==generation||!Array.isArray(response.rows)||response.rows.length!==1)return deny();
   const profile=projectPublicRow(response.rows[0],config,generation);
   if(!profile||profile.id!==r.providerId||JSON.stringify(profile.services)!==JSON.stringify(canonical.services))return deny();
   const fresh=record(await readCanonical(r.providerId,{signal}),['providerId','services','published','publicationEpoch']);
   if(!validCanonical(fresh,r.providerId,generation,config)||JSON.stringify(fresh)!==JSON.stringify(canonical)||signal?.aborted||await getPublicationEpoch({signal})!==generation||signal?.aborted)return deny();
   return Object.freeze({ok:true,profile,publicationEpoch:generation});
  }catch{return deny();}
 }});
}
function validCanonical(c,providerId,generation,catalog){return c&&c.providerId===providerId&&c.published===true&&c.publicationEpoch===generation&&Array.isArray(c.services)&&c.services.length>0&&c.services.length<=12&&c.services.every(s=>catalog.services.includes(s))&&normalizeServiceSelections(c.services).ok;}
export function projectPublicRow(raw,catalog,generation){
 const row=record(raw,DISCOVERY_FIELDS);
 if(!row||row.published!==true||row.publicationEpoch!==generation||!id(row.id)||!Array.isArray(row.services)||row.services.some(s=>!catalog.services.includes(s))||!catalog.localities.some(l=>l.city===row.city&&l.serviceArea===row.serviceArea))return null;
 const result=buildPublicProviderProfile(row);if(!result.ok)return null;
 return Object.freeze({...result.profile,services:Object.freeze(result.profile.services),languages:Object.freeze(result.profile.languages)});
}
export function createPublicProviderDetailRead({repository,...options}){return createBoundedRead({...options,read:(request,context)=>repository.detail(request,context),project:result=>result?.ok===true?result:null});}

export function createPublicProviderDiscoveryRead({repository,...options}){return createBoundedRead({...options,read:(request,context)=>repository.discover(request,context),project:result=>result?.ok===true?result:null});}
