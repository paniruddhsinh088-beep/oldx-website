// Defense in depth after trusted verification, not cryptographic authentication.
// Descriptor values are the ONLY values consumed: getters/Proxy get traps are
// never reread. A transparent Proxy may normalize safely; not all Proxies can be
// detected in JavaScript. The result is flat, immutable and prototype-free.
const allowed=new Set(['purpose','imageId','nonce','publicId','sourceDigest','assetId','expectedRevision','status','definitive','operationSettled','deliveryType','metadataStripped','contentScanned','byteSize','width','height','contentType','processedDigest']);
function snapshot(value){
 if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);if(keys.length>allowed.size||keys.some(k=>typeof k!=='string'||!allowed.has(k)))return null;
 const out=Object.create(null);for(const key of keys){const d=descriptors[key];if(!Object.hasOwn(d,'value'))return null;const v=d.value;if(v!==null&&!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)||typeof v==='string'&&v.length>256)return null;out[key]=v;}return Object.freeze(out);
}
export function snapshotVerifiedMediaProof(value,expected){try{
 const proof=snapshot(value),claims=snapshot(expected);if(!proof||!claims||!['upload','delete'].includes(claims.purpose)||!['present','absent'].includes(proof.status))return null;
 for(const key of ['purpose','imageId','nonce','publicId','expectedRevision',claims.purpose==='upload'?'sourceDigest':'assetId'])if(!Object.hasOwn(claims,key)||!Object.hasOwn(proof,key)||proof[key]!==claims[key])return null;
 return proof;
}catch{return null;}}
