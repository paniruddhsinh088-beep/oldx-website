import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStorePreviewLink } from './preview-share.mjs';
const valid={pageUrl:'https://preview.example/store-preview.html?token=PRIVATE#store/demo-shop/product/sample-1',origin:'https://preview.example',storeUid:'demo-shop'};
test('Store sample share URL contains only the same-origin canonical Store route',()=>{
  assert.deepEqual(buildStorePreviewLink(valid),{ok:true,url:'https://preview.example/store-preview.html#store/demo-shop'});
  assert.equal(JSON.stringify(buildStorePreviewLink(valid)).includes('PRIVATE'),false);
  assert.equal(buildStorePreviewLink({...valid,pageUrl:'http://127.0.0.1:1234/store-preview.html',origin:'http://127.0.0.1:1234'}).ok,true);
});
test('Store sample share builder rejects invalid IDs, credentials, foreign/insecure origins and non-preview pages',()=>{
  for(const patch of [{storeUid:'../secret'},{storeUid:'x'.repeat(129)},{storeUid:null},
    {pageUrl:'https://user:password@preview.example/store-preview.html'}, {origin:'https://elsewhere.example'},
    {pageUrl:'https://preview.example/index.html'}, {pageUrl:'http://preview.example/store-preview.html',origin:'http://preview.example'},
    {pageUrl:'javascript:alert(1)'},{pageUrl:'https://preview.example/'+ 'x'.repeat(2100)+'/store-preview.html'}]) {
    assert.equal(buildStorePreviewLink({...valid,...patch}).ok,false);
  }
  for(const value of [null,undefined,[],{},'url']) assert.equal(buildStorePreviewLink(value).ok,false);
});
