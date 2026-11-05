import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../../admin.html',import.meta.url),'utf8');
const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
test('legacy Admin cannot initialize Firestore or directly query or mutate documents',()=>{
 assert.doesNotMatch(source,/firebase-firestore|firebase\.firestore|\bdb\.collection|\.delete\(/);
 assert.match(source,/id="adminBackendStatus" role="status"/);
});
test('even direct invocation of legacy load/delete does no I/O and clears cached private data',async()=>{
 const stats=new Map();let ads,users;
 const forbidden=()=>{throw Error('unexpected privileged I/O');};
 const context={document:{getElementById:id=>{const node={};stats.set(id,node);return node;}},db:new Proxy({}, {get:forbidden}),fetch:forbidden,confirm:forbidden,renderAdsTable:rows=>ads=rows,renderUsersTable:rows=>users=rows};
 runInNewContext('let allAdsCache=[{private:true}],allUsersCache=[{private:true}];'+block('async function fetchAllAdminData()', 'function addTextCell(')+block('function deleteAdminAd(', 'function renderUsersTable(')+';this.load=fetchAllAdminData;this.remove=deleteAdminAd;',context);
 assert.equal((await context.load()).code,'ADMIN_BACKEND_NOT_CONFIGURED');assert.equal(context.remove('foreign-product').code,'ADMIN_BACKEND_NOT_CONFIGURED');assert.equal(ads.length,0);assert.equal(users.length,0);assert.equal(stats.size,4);for(const node of stats.values())assert.equal(node.textContent,'—');
});
