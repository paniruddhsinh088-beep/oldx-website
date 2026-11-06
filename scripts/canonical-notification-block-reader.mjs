import {safeId} from './isolated-firestore-context.mjs';import {resolveCanonicalChatBlocks} from './legacy-chat-prefix-plan.mjs';
// Explicit server composition; no SDK/network or fallback to an absent false edge.
// Cache only within one transaction, never across authorization/retry checkpoints.
export function createCanonicalNotificationBlockReader({enabled=false,productReaders,providerReaders}={}){
 if(enabled!==true)return async()=>null;if(![productReaders,providerReaders].every(r=>typeof r?.readBlock==='function'))throw Error('Both canonical block mappings required');const transactions=new WeakMap();
 return async(tx,from,to)=>{if(!safeId(from)||!safeId(to)||from===to)return null;let pairs=transactions.get(tx);if(!pairs){pairs=new Map();transactions.set(tx,pairs);}const participants=[from,to].sort(),key=JSON.stringify(participants);if(!pairs.has(key))pairs.set(key,(async()=>{const records=[];for(const reader of [productReaders,providerReaders])for(let d=0;d<2;d++)records.push(await reader.readBlock(tx,participants[d],participants[1-d]));const mapped=resolveCanonicalChatBlocks(participants,records);return mapped.ok?mapped.blocks:null;})());const blocks=await pairs.get(key);return blocks?{blockerUid:from,blockedUid:to,blocked:blocks[participants.indexOf(from)]}:null;};
}
