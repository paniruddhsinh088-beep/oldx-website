// Isolated in-memory transactional fixture. Never imports an SDK or live config.
const clone=value=>structuredClone(value);
export function fakeProviderTransactions(){
 let state={actors:{owner:{uid:'owner',canWrite:true,suspended:false}},owners:{},identities:{},drafts:{},receipts:{},audits:{},publicViews:{p1:{name:'Existing public fixture'}}},version=0;
 let queue=Promise.resolve();const api={attempts:0,commits:0,failStage:false,failCommit:false,afterReads:null,loseAck:false,
  snapshot:()=>clone(state),change:fn=>{fn(state);version++;},
  async runTransaction(callback,context){
   // Serialized commit boundary with a version-based retry when canonical facts
   // change during callback reads. Each failed stage/commit discards the snapshot.
   let unlock;const previous=queue;queue=new Promise(r=>unlock=r);await previous;
   try{for(let retry=0;retry<4;retry++){
    api.attempts++;const originalVersion=version,working=clone(state);let staged=null;
    const tx={getActorState:async uid=>clone(working.actors[uid]??null),getOwnedProvider:async uid=>clone(working.owners[uid]??null),
     getProviderIdentity:async id=>clone(working.identities[id]??null),
     getDraftMetadata:async id=>{const row=working.drafts[id];return row?{providerId:row.providerId,ownerUid:row.ownerUid,revision:row.revision}:null;},
     getIdempotency:async(uid,op,key)=>{if(api.afterReads){const hook=api.afterReads;api.afterReads=null;await hook(api);}return clone(working.receipts[JSON.stringify([uid,op,key])]??null);},
     getAudit:async id=>clone(working.audits[id]??null),
     stagePrivateDraft:mutation=>{staged=clone(mutation);if(api.failStage)throw new Error('private audit failure');}
    };
    const result=await callback(tx);
    if(version!==originalVersion)continue;
    if(staged){
     if(context.signal.aborted||Date.now()>=context.deadlineAt)throw new Error('Commit cancelled');
     if(api.failCommit)throw new Error('private commit failure');
     const m=staged,key=JSON.stringify([m.receipt.actorUid,m.receipt.operation,m.receipt.requestId]);
     if(m.mode==='create'&&(working.owners[m.canonical.ownerUid]||working.identities[m.canonical.providerId]||working.drafts[m.canonical.providerId]))throw new Error('Create collision');
     if(working.receipts[key]||working.audits[m.audit.id])throw new Error('Duplicate receipt/audit');
     working.identities[m.identity.providerId]=m.identity;working.owners[m.canonical.ownerUid]=m.canonical;working.drafts[m.draft.providerId]=m.draft;working.receipts[key]=m.receipt;working.audits[m.audit.id]=m.audit;
     state=working;version++;api.commits++;if(api.loseAck){api.loseAck=false;throw new Error('Acknowledgement lost');}
    }
    return result;
   }throw new Error('Retry exhausted');}finally{unlock();}
  }
 };return api;
}
