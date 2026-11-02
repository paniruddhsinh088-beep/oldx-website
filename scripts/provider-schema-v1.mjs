import {randomUUID} from 'node:crypto';
import {planPublicProviderQuery} from '../features/service-providers/provider-discovery.mjs';
import {createProviderDraftTransaction} from './provider-draft-transaction.mjs';
import {createProviderPublicationTransaction} from './provider-publication-transaction.mjs';
import {createProviderOwnerBootstrap} from './provider-owner-bootstrap.mjs';
const roles=['actors','owners','identities','drafts','receipts','audits','permissions','publications','publicViews','generations'];
// PROPOSAL ONLY. No Firebase config/index deployment references these paths.
export const PROVIDER_SCHEMA_V1=Object.freeze({version:1,market:'GJ',collections:Object.freeze({actors:'serviceProviderActors_v1',owners:'serviceProviderOwners_v1',identities:'serviceProviderIdentities_v1',drafts:'serviceProviderDrafts_v1',receipts:'serviceProviderReceipts_v1',audits:'serviceProviderAudit_v1',permissions:'serviceProviderPermissions_v1',publications:'serviceProviderPublications_v1',publicViews:'serviceProviderPublic_v1',generations:'serviceProviderGenerations_v1'})});
export const PROVIDER_V1_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(key=>[key,'testProviderV1'+key[0].toUpperCase()+key.slice(1)])));
// Random opaque candidates do not encode UID. Reservation happens only in the
// existing atomic owner/identity transaction, not by generating an ID or reading.
export function createProviderV1Integration({enabled=false,authenticate,repository,catalog,randomId=randomUUID,...lifecycle}={}){
 const valid=enabled===true&&catalog?.version===1&&catalog.stateCode==='GJ'&&planPublicProviderQuery({category:'',locality:'',limit:1,cursor:null},catalog,{publicationEpoch:0});
 const providerIdForActor=()=>{const candidate='sp_'+randomId();if(!/^sp_[A-Za-z0-9_-]{1,80}$/.test(candidate))throw new Error('Invalid Provider identity candidate');return candidate;};
 const options={...lifecycle,enabled:!!valid,authenticate,repository};
 const draft=createProviderDraftTransaction({...options,providerIdForActor}),publication=createProviderPublicationTransaction({...options,catalog}),bootstrap=createProviderOwnerBootstrap(options);
 return Object.freeze({saveDraft:(...args)=>draft.save(...args),managePublication:(...args)=>publication.execute(...args),bootstrap:(...args)=>bootstrap.load(...args)});
}
