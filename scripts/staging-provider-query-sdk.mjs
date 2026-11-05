import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {DISCOVERY_FIELDS} from '../features/service-providers/provider-discovery.mjs';
import {safeId} from './isolated-firestore-context.mjs';
// Normalizes the existing bounded Provider planner to native Admin queries.
// No SDK/app initialization or full-document browser filtering. Fixed SELECT only.
export function createStagingProviderQuerySdk({binding}={}){
 const b=requireStagingMarketplaceBinding(binding),c=b.providerCollections,tokens=new WeakMap();
 const token=value=>{const key=Object.freeze({});tokens.set(key,value);return key;};
 const get=key=>{b.check();const value=tokens.get(key);if(!value)throw Error('Unbound Provider query');return value;};
 const count=(rows,type)=>rows.filter(v=>v.type===type);
 const metadata=Object.freeze({fromCache:false,hasPendingWrites:false});
 const snapshot=s=>({id:s.id,metadata,exists:()=>s.exists,data:()=>s.data()});
 return Object.freeze({...b.sdk,
  collection(db,name){b.check();if(db!==b.db||name!==c.publicViews)throw Error('Private Provider query denied');return token({type:'collection'});},
  where(field,op,value){b.check();const text=typeof value==='string'&&value.length>0&&value.length<=120&&!/[\u0000-\u001f\u007f]/u.test(value);
   if(!(field==='published'&&op==='=='&&value===true||field==='id'&&op==='=='&&safeId(value)||field==='services'&&op==='array-contains'&&text&&value.length<=64||field==='serviceArea'&&op==='=='&&text))throw Error('Unsafe Provider predicate');return token({type:'where',field,op,value});
  },
  orderBy(field,direction){if(field!=='id'||direction!=='asc')throw Error('Unsafe Provider ordering');return token({type:'order'});},
  limit(n){if(!Number.isInteger(n)||n<1||n>25)throw Error('Unbounded Provider query');return token({type:'limit',n});},
  startAfter(id){if(!safeId(id))throw Error('Unsafe Provider cursor');return token({type:'after',id});},
  query(collection,...constraints){if(get(collection).type!=='collection'||constraints.length>6)throw Error('Invalid Provider collection');const rows=constraints.map(get),filters=count(rows,'where'),limits=count(rows,'limit');
   if(rows.some(r=>!['where','order','limit','after'].includes(r.type))||count(rows,'order').length!==1||limits.length!==1||count(rows,'after').length>1||filters.length<1||filters.length>3||!filters.some(r=>r.field==='published')||new Set(filters.map(r=>r.field)).size!==filters.length)throw Error('Incomplete Provider bounds');
   if(filters.some(r=>r.field==='id')&&(filters.length!==2||limits[0].n!==1||count(rows,'after').length))throw Error('Invalid Provider detail scope');return token({type:'query',rows,filters});
  },
  async getDocFromServer(ref){b.check();if(ref?.path!==c.generations+'/current')throw Error('Private Provider get denied');const result=await b.db.collection(c.generations).doc('current').get();b.check();return snapshot(result);},
  async getDocsFromServer(query){const plan=get(query);if(plan.type!=='query')throw Error('Unbound Provider read');let q=b.db.collection(c.publicViews).select(...DISCOVERY_FIELDS);
   for(const f of plan.filters)q=q.where(f.field,f.op,f.value);q=q.orderBy('id','asc');const after=count(plan.rows,'after')[0];if(after)q=q.startAfter(after.id);const maximum=count(plan.rows,'limit')[0].n;
   const result=await q.limit(maximum).get();b.check();if(!Array.isArray(result.docs)||result.docs.length>maximum)throw Error('Invalid Provider result bounds');return {metadata,docs:result.docs.map(snapshot)};
  }
 });
}
