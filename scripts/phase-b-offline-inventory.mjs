// Phase B: pure, offline inventory check only. No Firebase/Google SDK, network,
// credentials, live user/document inspection, creation or deletion.
import {createOfflinePreview} from './phase-b-offline-fixture-preflight.mjs';

const exactUsers=Object.freeze(['synthetic-seller-a','synthetic-buyer-b']);
const exactDocs=Object.freeze([
 'marketplaceActors_v1/synthetic-seller-a',
 'marketplacePrivate_v1/product_synthetic-phase-b-read-01'
]);
const permitted=['planned','created','verified','deleted','blocked'];
function required(condition,name){if(!condition)throw Error('Invalid Phase B inventory: '+name);}
const validUtc=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===new Date(Date.parse(s)).toISOString();

export function validateOfflinePhaseBInventory(value){
 required(value&&Object.getPrototypeOf(value)===Object.prototype,'inventory object');
 required(value.mode==='REVIEW_ONLY'&&value.projectId==='oldx-staging'&&value.databaseId==='(default)','target');
 required(value.cloudExecutionApproved===false&&value.cleanupApproved===false,'authorization');
 required(typeof value.runMarker==='string'&&/^phase-b-[a-f0-9]{16,32}$/.test(value.runMarker),'marker');
 required(Array.isArray(value.users)&&value.users.length===2,'users');
 required(Array.isArray(value.documents)&&value.documents.length===2,'documents');
 required(JSON.stringify(value.users.map(x=>x.uid))===JSON.stringify(exactUsers),'user IDs');
 required(JSON.stringify(value.documents.map(x=>x.path))===JSON.stringify(exactDocs),'document IDs');
 for(const entry of [...value.users,...value.documents]){
  required(Object.getPrototypeOf(entry)===Object.prototype,'entry');
  required(permitted.includes(entry.status),'status');
  required(entry.status==='planned','local-only status');
 }
 required(value.createdAt===null&&value.expiresAt===null,'no creation or expiry claim');
 required(value.actualWrites===0&&value.actualDeletes===0,'no mutations');
 required(value.quotaCounterPaths.length===0,'no discovered runtime counters');
 return Object.freeze({
  project:value.projectId,database:value.databaseId,
  runMarker:value.runMarker,users:exactUsers.slice(),documents:exactDocs.slice(),
  status:'REVIEW_ONLY',cloudOperationsPerformed:0
 });
}

export async function makeOfflinePhaseBInventory(marker='phase-b-0123456789abcdef'){
 const plan=await createOfflinePreview();
 required(plan.currentPermission==='PREPARATION_ONLY'&&plan.cloudOperationsPerformed===0,'offline-only base');
 return {
  mode:'REVIEW_ONLY',projectId:plan.project,databaseId:plan.database,
  runMarker:marker,cloudExecutionApproved:false,cleanupApproved:false,
  users:plan.authUsers.map(uid=>({uid,status:'planned'})),
  documents:plan.documentPaths.map(path=>({path,status:'planned'})),
  createdAt:null,expiresAt:null,quotaCounterPaths:[],
  actualWrites:0,actualDeletes:0
 };
}
