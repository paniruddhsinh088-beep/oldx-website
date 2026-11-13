// Phase B OFFLINE preparation guard. No Firebase Admin SDK, credentials, network,
// user creation, document read/write or deletion. Do NOT extend into a live seeder
// without a separate owner-reviewed design and explicit execution authorization.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function validatePhaseBPlan(p) {
 const must=(value,label)=>{if(!value)throw Error('Unsafe Phase B plan: '+label);};
 must(p?.mode==='LOCAL_PLAN_ONLY','mode');
 must(p.cloudWriteApproved===false&&p.runtimeActivationApproved===false,'activation/write approvals');
 must(p.projectId==='oldx-staging'&&p.databaseId==='(default)'&&p.productionProjectForbidden==='oldx-1c983','project/database');
 must(p.actors?.owner==='synthetic-seller-a'&&p.actors?.foreignBuyer==='synthetic-buyer-b','synthetic users');
 must(p.proposedDocument?.collection==='marketplacePrivate_v1'&&
  p.proposedDocument.id==='product_synthetic-phase-b-read-01'&&
  p.proposedDocument.ownerUid===p.actors.owner&&
  p.proposedDocument.data==='DESIGN_ONLY_NOT_A_FIRESTORE_WRITE_PAYLOAD','private record');
 must(p.eligibleActorCollection==='marketplaceActors_v1'&&
  p.quotaCollection==='marketplaceRateLimits_v1','namespaces');
 must(p.httpRoute==='/api/staging/marketplace/owner'&&p.httpMethod==='POST','private HTTP route');
 must(Array.isArray(p.scenarios)&&new Set(p.scenarios.map(s=>s.name)).size===7,'scenarios');
 must(p.prohibited?.includes('production-user-data')&&
  p.prohibited?.includes('service-account-key')&&
  p.prohibited?.includes('public-access-grant'),'prohibitions');
 return Object.freeze({
  phase:'B',mode:p.mode,project:p.projectId,database:p.databaseId,
  authUsers:[p.actors.owner,p.actors.foreignBuyer],
  documentPaths:[p.eligibleActorCollection+'/'+p.actors.owner,
   p.proposedDocument.collection+'/'+p.proposedDocument.id],
  quotaNamespace:p.quotaCollection,
  preflight:'Exact UID and document collision checks; STOP on any existing ID or unknown error',
  creation:'Separate approval required; create-only, no overwrite/merge',
  verify:'Exact-ID inspection; never list all users or documents',
  cleanup:'Separate exact-ID approval and safe ownership verification; no collection-wide deletes',
  retention:'Proposed maximum 24 hours; not a scheduled deletion',
  cloudOperationsPerformed:0,
  currentPermission:'PREPARATION_ONLY'
 });
}

export async function createOfflinePreview(){
 const manifest=JSON.parse(await readFile(new URL('../tests/integration/fixtures/phase-b-owner-read-plan.json',import.meta.url),'utf8'));
 return validatePhaseBPlan(manifest);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 if(process.argv.length!==3||process.argv[2]!=='--dry-run'){
  console.error('Only --dry-run is supported. No cloud operations implemented.');
  process.exitCode=2;
 } else {
  try{console.log(JSON.stringify(await createOfflinePreview(),null,2));}
  catch {console.error('Offline plan validation FAILED. No cloud operations performed.');process.exitCode=1;}
 }
}
