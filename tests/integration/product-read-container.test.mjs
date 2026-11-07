import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdir,copyFile,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

test('Docker COPY sources start on PORT without SDK credentials or operational access',async()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const dockerfile=await readFile(join(root,'Dockerfile.product-read'),'utf8');
 assert.match(dockerfile,/^FROM node:24-bookworm-slim$/m);
 assert.match(dockerfile,/^RUN npm ci --omit=dev --ignore-scripts$/m);
 assert.match(dockerfile,/^USER node$/m);
 assert.match(dockerfile,/^STOPSIGNAL SIGTERM$/m);
 const [,entry]=/^CMD \["node", "([^"]+)"\]$/m.exec(dockerfile);
 const ignore=await readFile(join(root,'Dockerfile.product-read.dockerignore'),'utf8');
 const allowed=new Set(ignore.split(/\r?\n/).filter(line=>line.startsWith('!')&&!line.endsWith('/')).map(line=>line.slice(1)));
 assert.equal(ignore.split(/\r?\n/)[0],'**');
 const dir=await mkdtemp(join(tmpdir(),'oldx-product-container-'));
 let child,exited;
 try{
  for(const line of dockerfile.match(/^COPY .+$/gm)){
   const sources=line.slice(5).split(/\s+/),destination=sources.pop();
   assert.match(destination,/^\.\/(?:[\w/-]+\/)?$/);
   const target=join(dir,destination);
   await mkdir(target,{recursive:true});
   for(const source of sources){
    assert.match(source,/^(?:package(?:-lock)?\.json|(?:features|functions|scripts)\/[\w/-]+\.mjs)$/);
    assert.equal(allowed.delete(source),true);
    await copyFile(join(root,source),join(target,source.split('/').at(-1)));
   }
  }
  assert.equal(allowed.size,0);
  const hold=createServer();hold.listen(0,'0.0.0.0');await once(hold,'listening');
  const port=hold.address().port;
  await new Promise(resolve=>hold.close(resolve));
  const env={SystemRoot:process.env.SystemRoot??'',NODE_ENV:'production',PORT:String(port)};
  const invalid=spawnSync(process.execPath,[entry],{cwd:dir,env:{...env,PORT:'invalid'},timeout:5000,encoding:'utf8'});
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/startup failed/);
  child=spawn(process.execPath,[entry],{cwd:dir,env:{...env,
   OLDX_PRODUCT_READ_STAGING_ADC:'true',OLDX_FIREBASE_ENV:'staging',OLDX_FIREBASE_PROJECT_ID:'oldx-staging',
   K_SERVICE:'oldx-owner-read',OLDX_PRODUCT_READ_SERVICE_ACCOUNT:'owner-read@oldx-staging.iam.gserviceaccount.com',
   OLDX_RATE_WINDOW_MS:'60000',OLDX_RATE_ACTOR_LIMIT:'10',OLDX_RATE_GLOBAL_LIMIT:'100'},stdio:'ignore'});
  exited=once(child,'exit');
  let reply;
  for(let attempt=0;attempt<40&&!reply&&child.exitCode===null;attempt++){
   try{reply=await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(250)});}
   catch{await delay(50);}
  }
  assert.equal(reply?.status,200);
  assert.deepEqual(await reply.json(),{ok:true});
  const owner=await fetch('http://127.0.0.1:'+port+'/api/staging/marketplace/owner',{
   method:'POST',signal:AbortSignal.timeout(1000)
  });
  assert.equal(owner.status,503);
  assert.deepEqual(await owner.json(),{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}});
 }finally{
  if(child&&child.exitCode===null&&child.signalCode===null)child.kill();
  if(exited)await exited;
  await rm(dir,{recursive:true,force:true});
 }
});
