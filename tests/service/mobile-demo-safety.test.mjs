import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {copy} from '../../features/mobile-demo/copy.mjs';
import {buildVisualReview} from '../../scripts/build-visual-review.mjs';
test('mobile demo is isolated, translated and cannot call live services',async()=>{
 const html=await readFile(new URL('../../mobile-demo.html',import.meta.url),'utf8'),source=await readFile(new URL('../../features/mobile-demo/demo.mjs',import.meta.url),'utf8');assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);assert.doesNotMatch(source,/\bfetch\s*\(|localStorage|sessionStorage|from[^;\n]*(?:firebase|cloudinary)|innerHTML\s*=/i);for(const lang of ['gu','hi'])assert.deepEqual(Object.keys(copy[lang]).sort(),Object.keys(copy.en).sort());for(const catalog of Object.values(copy))for(const value of Object.values(catalog))assert.ok(typeof value==='string'&&value.length>0);
});

test('visual-review packaging rejects unsafe material before writing',async()=>{
 const readSource=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
 const options={sha:'a'.repeat(40),date:'2026-11-12'};
 for(const [injection,error] of [
  ['https://example.invalid/api','External URL'],
  ['-----BEGIN PRIVATE KEY-----','Forbidden material'],
  ['firebase-env.js','Forbidden material']
 ]){
  await assert.rejects(buildVisualReview({...options,readSource:async path=>(await readSource(path))+
   (path==='features/mobile-demo/demo.mjs'?injection:'')}),new RegExp(error));
 }
 await assert.rejects(buildVisualReview({...options,readSource:path=>path==='index.html'?'':readSource(path)}),/Homepage markup changed/);
});

test('local demo server serves only reviewed browser assets and rejects private files',async()=>{
 const {createMobileDemoServer}=await import('../../scripts/serve-mobile-demo.mjs');const server=createMobileDemoServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(origin+'/')).status,200);for(const path of ['/index.html','/admin.html','/firebase-env.js','/.git/config','/functions/staging-marketplace/runtime.mjs','/api/staging/marketplace/save','/%2e%2e/AGENTS.md'])assert.equal((await fetch(origin+path)).status,404,path);assert.equal((await fetch(origin+'/mobile-demo.html',{method:'POST'})).status,405);}finally{await new Promise(r=>server.close(r));}
});
