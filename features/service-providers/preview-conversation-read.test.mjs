import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationRead,projectSampleConversationRead,createMockConversationRead} from './preview-conversation-read.mjs';
import {createSampleBuyerInbox} from './preview-inbox-fixtures.mjs';
import {createSampleConversationMessages} from './preview-conversation.mjs';
const scope={role:'buyer',providerId:'p1',enquiryId:'p1-sample-3'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>Promise.resolve();
function response(s=scope){const context=createSampleBuyerInbox(s.providerId);return {...s,context,revision:0,messages:createSampleConversationMessages(context,s.enquiryId),blocks:{buyerBlocked:false,providerBlocked:false}};}
test('conversation projection binds actor/provider/enquiry, block facts and bounded copied DTOs',()=>{
 const r=response(),view=projectSampleConversationRead(r,scope);assert.equal(view.ok,true);assert.ok(Object.isFrozen(view.items[0]));r.messages[0].text='late mutation';assert.notEqual(view.items[0].text,r.messages[0].text);
 for(const bad of [{...r,role:'provider'},{...r,providerId:'p2'},{...r,enquiryId:'p1-sample-4'},{...r,revision:1},{...r,blocks:{}},{...r,messages:Array(36).fill(r.messages[0])}])assert.equal(projectSampleConversationRead(bad,scope),null);
 assert.equal(projectSampleConversationRead(response({...scope,enquiryId:'p1-sample-2'}),{...scope,enquiryId:'p1-sample-2'}),null);
});
test('new scope cancels old callers even when adapter ignores abort and rejects late results',async()=>{
 const calls=[],states=[];const loader=createConversationRead({read:(r,{signal})=>{const d=deferred();calls.push({r,signal,...d});return d.promise;},onChange:s=>states.push(s)});
 const a=loader.load(scope);await flush();const next={...scope,role:'provider'},b=loader.load(next);await flush();await a;
 assert.equal(calls[0].signal.aborted,true);assert.equal(states.at(-1).status,'loading');calls[1].resolve(response(next));await b;assert.equal(states.at(-1).status,'ready');
 const count=states.length;calls[0].resolve(response());await flush();assert.equal(states.length,count);loader.clear();assert.equal(states.at(-1).status,'idle');
});
test('deadline, error, malformed, empty and revoked response recovery is deterministic',async()=>{
 let expire,read=()=>new Promise(()=>{});const states=[];const loader=createConversationRead({read:(...args)=>read(...args),onChange:s=>states.push(s),schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});
 const task=loader.load(scope);await flush();expire();await task;assert.equal(states.at(-1).code,'READ_TIMEOUT');
 read=()=>{throw new Error('private token');};await loader.load(scope);assert.equal(states.at(-1).code,'READ_FAILED');assert.equal(JSON.stringify(states).includes('private token'),false);
 read=()=>({});await loader.load(scope);assert.equal(states.at(-1).status,'unavailable');
 read=()=>({...response(),messages:[]});await loader.load(scope);assert.equal(states.at(-1).snapshot.items.length,0);
 const r=response();r.context.provider.published=false;read=()=>r;await loader.load(scope);assert.equal(states.at(-1).status,'unavailable');
});
test('revocation and page exit suppress pending completion and clear timers',async()=>{
 let stopped=0;const d=deferred(),states=[];const loader=createConversationRead({read:()=>d.promise,onChange:s=>states.push(s),schedule:()=>1,cancel:()=>stopped++});
 const task=loader.load(scope);await flush();loader.revoke();await task;assert.equal(states.at(-1).status,'unavailable');d.reject(new Error('late private failure'));await flush();assert.equal(states.length,2);assert.equal(stopped,1);
});
test('mock abort removes pending local delay without emitting or reading real data',async()=>{
 let fire,stopped=0;const mock=createMockConversationRead({schedule:fn=>{fire=fn;return 1;},cancel:()=>stopped++});const abort=new AbortController();const task=mock(scope,{signal:abort.signal});abort.abort();await assert.rejects(task);assert.equal(stopped,1);assert.equal(typeof fire,'function');
});
