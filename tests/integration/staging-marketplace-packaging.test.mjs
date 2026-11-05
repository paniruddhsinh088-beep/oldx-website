import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {stagingMarketplaceRouteArtifacts,stagingMediaRouteArtifacts,stagingProviderMediaRouteArtifacts} from '../../functions/staging-marketplace/route-artifacts.mjs';
const root=resolve(import.meta.dirname,'../..');
test('generated staging routes package complete server import closure and remain disabled',async()=>{
 const output=await mkdtemp(resolve(tmpdir(),'oldx-staging-package-')),seen=new Set();
 async function copy(file){
  if(seen.has(file))return;seen.add(file);assert.ok(file.startsWith(root+'/scripts/')||file.startsWith(root+'/functions/')||file.startsWith(root+'/features/'),relative(root,file));
  const source=await readFile(file,'utf8'),target=resolve(output,relative(root,file));await mkdir(dirname(target),{recursive:true});await writeFile(target,source);
  for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g))await copy(resolve(dirname(file),match[2]));
 }
 try{
  for(const [route,source] of Object.entries({...stagingMarketplaceRouteArtifacts(),...stagingMediaRouteArtifacts(),...stagingProviderMediaRouteArtifacts()})){
   await assert.rejects(access(resolve(root,route)));const target=resolve(output,route);await mkdir(dirname(target),{recursive:true});await writeFile(target,source);
   const dependency=/from '([^']+)'/.exec(source)[1];await copy(resolve(root,dirname(route),dependency));
   // No SDK package/credentials exist in this isolated output. Default handler
   // must import and return 503 without dynamically initializing the SDK.
   const probe=`globalThis.fetch=()=>{throw Error('network forbidden')};const {default:handler}=await import(${JSON.stringify(pathToFileURL(target).href)});const r=await handler.fetch(new Request('https://preview.invalid'));if(r.status!==503||r.headers.get('cache-control')!=='private, no-store')process.exit(1);`;
   execFileSync(process.execPath,['--input-type=module','--eval',probe],{env:{OLDX_STAGING_COMMANDS_ENABLED:'false',VERCEL_ENV:'preview'},timeout:5000,stdio:'pipe'});
  }
  assert.ok(seen.size>5);for(const suffix of ['app','auth','firestore'])assert.ok(import.meta.resolve('firebase-admin/'+suffix).includes('firebase-admin'));
  const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));assert.equal(pkg.dependencies['firebase-admin'],'14.5.0');assert.equal(pkg.dependencies.sharp,'0.35.5');assert.equal(pkg.devDependencies.sharp,undefined);assert.equal((await import('sharp')).default.versions.sharp,'0.35.5');
 }finally{await rm(output,{recursive:true,force:true});}
});
