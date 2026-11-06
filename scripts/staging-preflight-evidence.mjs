// OFFLINE documentary consistency check. No SDK, filesystem, network or execution port.
// Evidence claims require independent operator verification; never grants authority.
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
function documentaryCopy(value,seen=new Set(),depth=0,budget={nodes:0}){
 if(++budget.nodes>10000||depth>16)throw Error('Evidence limit');
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(!value||typeof value!=='object'||seen.has(value)||!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)throw Error('Plain evidence required');
 seen.add(value);const out=Array.isArray(value)?[]:Object.create(null);
 for(const key of Reflect.ownKeys(value)){if(Array.isArray(value)&&key==='length')continue;if(typeof key!=='string')throw Error('Invalid evidence key');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))throw Error('Accessor evidence refused');out[key]=documentaryCopy(d.value,seen,depth+1,budget);}
 seen.delete(value);return out;
}
export function inspectStagingEvidence(value){
 const blockers=[];const require=(ok,code)=>{if(!ok)blockers.push(code);};
 try{
  const v=documentaryCopy(value);
  require(v?.schemaVersion===1,'SCHEMA_VERSION');
  require(v?.project?.id==='oldx-staging'&&v.project.number==='38472235077','PROJECT_IDENTITY');
  require(text(v?.databaseId)&&typeof v.sourceRevision==='string'&&/^[a-f0-9]{40}$/.test(v.sourceRevision),'DATABASE_REVISION');
  require(text(v?.rules?.release)&&hash(v.rules.sha256)&&text(v.rules.rollbackRelease),'RULES_SNAPSHOT_ROLLBACK');
  require(v?.inventory?.complete===true&&v.inventory.includesSubcollections===true&&v.inventory.includesOrphanSubcollections===true&&hash(v.inventory.sha256)&&Array.isArray(v.inventory.collectionCounts)&&v.inventory.collectionCounts.every(row=>text(row.path)&&Number.isSafeInteger(row.count)&&row.count>=0)&&new Set(v.inventory.collectionCounts.map(row=>row.path)).size===v.inventory.collectionCounts.length,'COMPLETE_INVENTORY');
  require(text(v?.backup?.artifactLocation)&&hash(v.backup.manifestSha256)&&v.backup.manifestSha256===v.backup.verifiedSha256&&v.backup.firestoreTypesPreserved===true,'RESTORABLE_BACKUP');
  require(v?.restore?.verified===true&&typeof v.restore.isolatedTarget==='string'&&/^demo-oldx-[a-z0-9-]+$/.test(v.restore.isolatedTarget)&&hash(v.restore.sourceManifestSha256)&&v.restore.sourceManifestSha256===v.backup?.manifestSha256&&v.restore.restoredManifestSha256===v.restore.sourceManifestSha256,'RESTORE_COMPARISON');
  require(v?.permissions?.readVerified===true&&v.permissions.restoreVerified===true&&v.permissions.rulesRollbackVerified===true&&text(v.permissions.evidence),'OPERATOR_PERMISSIONS');
  require(v?.cost?.additionalCost===0&&v.cost.eligibilityVerified===true&&text(v.cost.evidence),'ZERO_COST_ELIGIBILITY');
  require(v?.compatibility?.passed===true&&text(v.compatibility.evidence)&&['users','products','stores','chats','serviceProviders'].every(k=>v.compatibility.domains?.[k]===true),'COMPATIBILITY_ACCEPTANCE');
  require(text(v?.independentReviewId),'INDEPENDENT_REVIEW');
 }catch{blockers.push('INVALID_EVIDENCE');}
 return Object.freeze({readyForManualReview:blockers.length===0,executionAuthorized:false,blockers:Object.freeze(blockers)});
}
