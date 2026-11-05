import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {safeId} from './isolated-firestore-context.mjs';
const fields=Object.freeze(['id','kind','revision','title','name','description','category','categories','locationLabel','basePrice','isSold','storeId']);
// Server-only Admin query normalization; exact public namespace/field projection.
// No app initialization, credentials, arbitrary query fields or unbounded reads.
export function createStagingPublicQuerySdk({binding,Filter}={}){
 const b=requireStagingMarketplaceBinding(binding),tokens=new WeakMap();
 const token=value=>{const t=Object.freeze({});tokens.set(t,value);return t;};
 const value=t=>{b.check();const v=tokens.get(t);if(!v)throw Error('Unbound public query');return v;};
 const count=(constraints,type)=>constraints.filter(v=>v.type===type);
 const condition=t=>{const v=value(t);if(!['where','and','or'].includes(v.type))throw Error('Invalid predicate');return v;};
 const sdk={...b.sdk,
  collection(db,name){b.check();if(db!==b.db||name!==b.collections.publicViews)throw Error('Private collection denied');return token({type:'collection'});},
  where(field,op,v){b.check();if(typeof v!=='string'||!safeId(v)||!(['kind','category','storeId'].includes(field)&&op==='=='||field==='categories'&&op==='array-contains')||field==='kind'&&!['product','store'].includes(v))throw Error('Unsafe public predicate');return token({type:'where',field,op,value:v});},
  and(...filters){if(filters.length<1||filters.length>3)throw Error('Unbounded predicates');return token({type:'and',filters:filters.map(condition)});},
  or(...filters){const rows=filters.map(condition);if(rows.length!==2||rows[0].type!=='where'||rows[1].type!=='where'||rows[0].field!=='category'||rows[0].op!=='=='||rows[1].field!=='categories'||rows[1].op!=='array-contains'||rows[0].value!==rows[1].value)throw Error('Unsafe OR scope');return token({type:'or',filters:rows});},
  orderBy(field,direction){if(field!=='id'||direction!=='asc')throw Error('Unsafe order');return token({type:'order'});},
  limit(n){if(!Number.isInteger(n)||n<1||n>25)throw Error('Unbounded public query');return token({type:'limit',n});},
  startAfter(id){if(!safeId(id))throw Error('Invalid cursor');return token({type:'after',id});},
  query(collection,...constraints){if(value(collection).type!=='collection'||constraints.length>6)throw Error('Unbounded public query');const rows=constraints.map(value);if(rows.some(r=>!['where','and','or','order','limit','after'].includes(r.type)))throw Error('Invalid constraint');const filters=rows.filter(r=>['where','and','or'].includes(r.type));
   if(count(rows,'order').length!==1||count(rows,'limit').length!==1||count(rows,'after').length>1||filters.length<1||filters.length>3)throw Error('Incomplete public bounds');
   const flat=[];function walk(v,depth=0){if(depth>2||flat.length>3)throw Error('Unbounded predicate depth');if(v.type==='and'){for(const child of v.filters)walk(child,depth+1);}else flat.push(v);}filters.forEach(v=>walk(v));
   const kinds=flat.filter(r=>r.type==='where'&&r.field==='kind');if(kinds.length!==1||flat.length>3)throw Error('Missing kind scope');const kind=kinds[0].value;
   if(flat.some(r=>r.type==='or'&&kind!=='store'||r.type==='where'&&r.field==='storeId'&&kind!=='product'||r.type==='where'&&r.field==='categories')||new Set(flat.map(r=>r.type==='or'?'category':r.field)).size!==flat.length)throw Error('Conflicting public scope');
   return token({type:'query',rows,filters});
  },
  async getDocFromServer(ref){b.check();if(ref?.path!==b.collections.generations+'/current')throw Error('Private get denied');const snapshot=await b.db.collection(b.collections.generations).doc('current').get();b.check();return {exists:()=>snapshot.exists,data:()=>snapshot.data()};},
  async getDocsFromServer(query){const plan=value(query);if(plan.type!=='query')throw Error('Unbound public query');let q=b.db.collection(b.collections.publicViews).select(...fields);
   const apply=(query,node)=>{if(node.type==='and'){for(const child of node.filters)query=apply(query,child);return query;}if(node.type==='or'){if(typeof Filter?.or!=='function'||typeof Filter?.where!=='function')throw Error('Native OR unavailable');return query.where(Filter.or(...node.filters.map(f=>Filter.where(f.field,f.op,f.value))));}return query.where(node.field,node.op,node.value);};
   for(const filter of plan.filters)q=apply(q,filter);q=q.orderBy('id','asc');const after=count(plan.rows,'after')[0];if(after)q=q.startAfter(after.id);const maximum=count(plan.rows,'limit')[0].n;q=q.limit(maximum);
   const result=await q.get();b.check();if(!Array.isArray(result.docs)||result.docs.length>maximum)throw Error('Unbounded response');return {metadata:{fromCache:false,hasPendingWrites:false},docs:result.docs.map(doc=>({id:doc.id,data:()=>doc.data()}))};
  }
 };
 return Object.freeze(sdk);
}
