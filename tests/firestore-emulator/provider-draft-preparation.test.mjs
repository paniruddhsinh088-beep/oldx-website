import test from 'node:test';import assert from 'node:assert/strict';
import {prepareProviderDraftIntent,createProviderDraftPreparation} from '../../scripts/provider-draft-preparation.mjs';
const profile={displayName:'Sample',city:'Sample city',serviceArea:'Sample locality',services:['Plumber'],description:'Sample only',experienceYears:2,available:true,languages:['en']};
const request={requestId:'sample-request-1',expectedRevision:2,profile};
const canonical={providerId:'p1',ownerUid:'sample-owner',revision:2,status:'draft'};
test('draft intent defaults off and cannot forge owner, publication, revision, ID or privileged profile fields',()=>{
 assert.equal(prepareProviderDraftIntent(request,canonical,'sample-owner'),null);
 const result=prepareProviderDraftIntent(request,canonical,'sample-owner',{enabled:true});assert.equal(result.operation,'save-provider-private-draft');assert.equal(result.providerId,'p1');assert.equal(Object.hasOwn(result,'published'),false);assert.equal(Object.hasOwn(result.draft,'ownerUid'),false);
 for(const [r,c,actor] of [[request,canonical,'foreign'],[{...request,expectedRevision:1},canonical,'sample-owner'],[{...request,ownerUid:'forged'},canonical,'sample-owner'],[request,{...canonical,status:'suspended'},'sample-owner'],[{...request,profile:{...profile,isVerified:true}},canonical,'sample-owner']])assert.equal(prepareProviderDraftIntent(r,c,actor,{enabled:true}),null);
});
test('preparation derives owner from verified identity, reads only owned context, snapshots input and never commits',async()=>{
 const events=[];let release;const mutable={...request,profile:{...profile,services:['Plumber']}};
 const executor=createProviderDraftPreparation({enabled:true,authenticate:()=>{events.push('auth');return new Promise(r=>release=r);},readOwnedProvider:uid=>{events.push('owned-read');assert.equal(uid,'sample-owner');return canonical;}});
 const pending=executor.prepare(mutable,{credential:'synthetic'});await Promise.resolve();mutable.profile.services[0]='Carpenter';mutable.profile.displayName='Changed';release({uid:'sample-owner'});const result=await pending;assert.equal(result.status,'ready');assert.equal(result.snapshot.draft.displayName,'Sample');assert.deepEqual(result.snapshot.draft.services,['Plumber']);assert.deepEqual(events,['auth','owned-read']);
 assert.equal((await createProviderDraftPreparation().prepare(request)).status,'unavailable');
});
test('malformed/accessor input, auth denial, ignored cancellation and deadline recovery do not expose private errors',async()=>{
 let getter=0;const accessor={...request};Object.defineProperty(accessor,'profile',{enumerable:true,get(){getter++;return profile;}});const executor=createProviderDraftPreparation({enabled:true,authenticate:()=>{throw new Error('private token');},readOwnedProvider:()=>canonical});assert.equal((await executor.prepare(accessor)).status,'unavailable');assert.equal(getter,0);const denied=await executor.prepare(request);assert.equal(denied.status,'error');assert.equal(JSON.stringify(denied).includes('token'),false);
 let release,reads=0;const abort=new AbortController();const cancel=createProviderDraftPreparation({enabled:true,authenticate:()=>new Promise(r=>release=r),readOwnedProvider:()=>reads++});const pending=cancel.prepare(request,{signal:abort.signal});await Promise.resolve();abort.abort();assert.equal((await pending).status,'cancelled');release({uid:'sample-owner'});await Promise.resolve();await Promise.resolve();assert.equal(reads,0);
 let expire;const timeout=createProviderDraftPreparation({enabled:true,authenticate:()=>new Promise(()=>{}),readOwnedProvider:()=>canonical,schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});const task=timeout.prepare(request);await Promise.resolve();expire();assert.equal((await task).code,'READ_TIMEOUT');
});
