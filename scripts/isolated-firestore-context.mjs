// Injected SDK only: no app initialization, credentials, endpoint or live mode.
export function isolatedFirestoreContext({firestore,sdk,schema,roles}={}){
 const db=firestore?._delegate??firestore,project=db?.app?.options?.projectId,settings=db?._getSettings?.();
 if(typeof project!=='string'||!/^demo-oldx-[a-z0-9-]{1,60}$/.test(project)||!settings||!/^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(settings.host)||Number(settings.host.split(':')[1])>65535||settings.ssl!==false||!Array.isArray(roles)||!schema||Reflect.ownKeys(schema).sort().join(',')!==[...roles].sort().join(',')||roles.some(k=>typeof schema[k]!=='string'||!/^testOldx[A-Za-z0-9]{1,48}$/.test(schema[k]))||new Set(Object.values(schema)).size!==roles.length||!['doc','runTransaction','serverTimestamp'].every(k=>typeof sdk?.[k]==='function'))throw new Error('Isolated SDK unavailable');
 return {db,collections:Object.freeze({...schema})};
}
export const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function copyRecord(value,keys){try{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).sort().join(',')!==[...keys].sort().join(','))return null;const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;}catch{return null;}}
export function isolatedTransactionCheck(signal,deadlineAt,now=Date.now){if(signal?.aborted||!Number.isSafeInteger(deadlineAt)||now()>=deadlineAt)throw new Error('Isolated transaction stopped');}
