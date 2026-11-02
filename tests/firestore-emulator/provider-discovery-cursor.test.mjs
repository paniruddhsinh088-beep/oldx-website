import test from 'node:test';import assert from 'node:assert/strict';
import {createProviderDiscoveryCursorCodec} from '../../scripts/provider-discovery-cursor.mjs';
const key=Buffer.alloc(32,7); // Synthetic test bytes only, never deployment material.
const state={scope:'sample-category-and-locality',publicationEpoch:1,after:'p2'};
test('authenticated cursor round-trips, rejects modification/foreign keys, and has bounded expiry',()=>{
 let now=100000;const codec=createProviderDiscoveryCursorCodec({key,now:()=>now,ttlMs:1000}),token=codec.issueCursor(state);assert.deepEqual(codec.readCursor(token),state);assert.deepEqual(codec.readCursor(token),state);
 assert.equal(codec.readCursor(token.replace(/.$/,token.endsWith('A')?'B':'A')),null);assert.equal(createProviderDiscoveryCursorCodec({key:Buffer.alloc(32,8),now:()=>now}).readCursor(token),null);
 now+=1001;assert.equal(codec.readCursor(token),null);now=99999;assert.equal(codec.readCursor(token),null);
 for(const value of ['',null,'private/path','a'.repeat(1025),'e30.invalid'])assert.equal(codec.readCursor(value),null);
});
test('cursor configuration rejects weak keys and excessive TTL; caller key mutation cannot change signatures',()=>{
 for(const options of [{key:Buffer.alloc(2)},{key,ttlMs:0},{key,ttlMs:300001}])assert.throws(()=>createProviderDiscoveryCursorCodec(options));
 const mutable=Buffer.alloc(32,9),codec=createProviderDiscoveryCursorCodec({key:mutable,now:()=>100000});const token=codec.issueCursor(state);mutable.fill(0);assert.deepEqual(codec.readCursor(token),state);
});
