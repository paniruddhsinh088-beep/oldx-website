import test from 'node:test';import assert from 'node:assert/strict';import {parseSampleInboxRoute} from './preview-inbox-route.mjs';
test('inbox routes select bounded sample IDs without accepting encoded paths, roles or notes',()=>{
 assert.deepEqual(parseSampleInboxRoute('#inbox/p1/enquiry/p1-sample-1'),{providerId:'p1',enquiryId:'p1-sample-1'});
 assert.equal(parseSampleInboxRoute('').providerId,'p1');
 for(const hash of ['#inbox/../private','#inbox/p1/enquiry/%2Fsecret','#inbox/p1?role=admin','#inbox/'+ 'x'.repeat(101),null,{},'#inbox/p1/enquiry/id/notes'])assert.equal(parseSampleInboxRoute(hash),null);
});
