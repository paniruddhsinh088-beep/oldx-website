import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSampleEnquiry} from './preview-enquiry.mjs';
const provider={id:'p1',services:['સુથાર','ફર્નિચર રિપેર']};
const valid={service:'સુથાર',description:'નમૂનાની ખુરશી રિપેર કરવી',timing:'flexible'};
test('sample enquiry is bound to selected provider/service with a strict local DTO',()=>{
 assert.deepEqual(inspectSampleEnquiry({...provider,phone:'PRIVATE'},valid),{ok:true,value:{providerId:'p1',...valid}});
 assert.equal(Object.hasOwn(inspectSampleEnquiry(provider,valid).value,'phone'),false);
 assert.equal(inspectSampleEnquiry(provider,{...valid,service:'ફર્નિચર રિપેર'}).ok,true);
});
test('enquiry rejects forged services, identity/role extras, unsafe notes and malformed timing',()=>{
 for(const patch of [{service:'Other'},{providerId:'p2'},{senderUid:'PRIVATE'},{role:'admin'},{description:'<img>'},{description:'x'.repeat(401)},{description:'bad\u0085'},{description:'ok'},{timing:'confirmed'}]) assert.equal(inspectSampleEnquiry(provider,{...valid,...patch}).ok,false);
 assert.equal(inspectSampleEnquiry({...provider,id:'../private'},valid).ok,false);
});
test('sample notes preserve Unicode and line breaks without translating authored text',()=>{
 const description='Cafe\u0301 · नमूना કામ\nA sample repair';
 assert.equal(inspectSampleEnquiry(provider,{...valid,description}).value.description,description.normalize('NFC'));
 assert.deepEqual(inspectSampleEnquiry(provider,null),{ok:false,fields:['service','description','timing']});
});
