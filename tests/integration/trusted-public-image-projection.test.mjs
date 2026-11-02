import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTrustedPublicImages} from '../../scripts/trusted-public-image-projection.mjs';

const imageId = 'sample-image-123456789012';
const associationId = 'a'.repeat(64);
function fixture(kind = 'product') {
  const parent = {id:'sample-parent',kind,ownerUid:'seller',revision:3,publicationRevision:3,published:true,profile:{privatePhone:'never disclose'}};
  const publicView = {id:parent.id,kind,revision:3};
  const actor = {uid:'seller',canWrite:true,suspended:false};
  const association = {kind,parentId:parent.id,ownerUid:'seller',service:null,visibility:'private',parentRevision:3,photoRevision:2,imageIds:[imageId]};
  const assets = [{imageId,kind,parentId:parent.id,ownerUid:'seller',service:null,state:'attached',revision:5,references:[associationId]}];
  const releases = [{imageId,kind,parentId:parent.id,ownerUid:'seller',status:'approved',moderationApproved:true,metadataStripped:true,contentScanned:true,delivery:'public-derivative',publicationRevision:3,photoRevision:2,assetRevision:5,contentType:'image/webp',byteSize:1024,width:320,height:240,publicUrl:'https://private.example',objectKey:'secret'}];
  return {enabled:true,mode:'isolated-test',kind,parent,publicView,actor,associationId,association,assets,releases};
}
const project = input => projectTrustedPublicImages(input);
const denied = input => assert.deepEqual(project(input), {ok:false,code:'UNAVAILABLE'});
test('disabled by missing trusted snapshots and unsupported private surfaces', () => {
  denied(); denied({...fixture(),enabled:false}); denied({...fixture(),mode:'production'}); for (const kind of ['chat','profile','provider-service','__proto__']) denied({...fixture(),kind});
});
test('public product image projection returns only fixed metadata, never URLs, secrets or private fields', () => {
  const result = project(fixture());
  assert.deepEqual(result,{ok:true,images:[{imageId,width:320,height:240,contentType:'image/webp'}]});
  assert.equal(JSON.stringify(result).includes('private'),false);
  assert.equal(JSON.stringify(result).includes('seller'),false);
  assert.equal(JSON.stringify(result).includes('http'),false);
  assert.equal(Object.isFrozen(result.images[0]),true);
});
test('published moderated Store image is supported, but more than one Store image is denied', () => {
  assert.equal(project(fixture('store')).ok,true);
  const input=fixture('store'); input.association.imageIds.push('second-image-1234567890');denied(input);
});
test('withdrawal, suspension, stale public view and draft-after-publication fail closed', () => {
  for(const change of [x=>x.parent.published=false,x=>x.actor.suspended=true,x=>x.actor.canWrite=false,
    x=>x.publicView.revision=2,x=>x.parent.revision=4,x=>x.association.parentRevision=2]) {
    const input=fixture();change(input);denied(input);
  }
});
test('private association alone never grants public access without separate processed release', () => {
  for(const change of [x=>x.releases=[],x=>x.releases[0].status='quarantined',
    x=>x.releases[0].moderationApproved=false,x=>x.releases[0].metadataStripped=false,
    x=>x.releases[0].contentScanned=false,x=>x.releases[0].delivery='private']) {
    const input=fixture();change(input);denied(input);
  }
});
test('cross-owner, parent, surface, association and asset revision mismatches deny all', () => {
  for(const change of [x=>x.assets[0].ownerUid='other',x=>x.releases[0].parentId='other',
    x=>x.releases[0].kind='store',x=>x.assets[0].references=[],
    x=>x.releases[0].assetRevision=4,x=>x.releases[0].photoRevision=1,
    x=>x.releases[0].publicationRevision=2,x=>x.association.visibility='public']) {
    const input=fixture();change(input);denied(input);
  }
});
test('invalid decoder metadata, oversized images and wrong content type fail closed', () => {
  for(const change of [x=>x.releases[0].width=0,x=>x.releases[0].height=90000,
    x=>x.releases[0].byteSize=Infinity,x=>x.releases[0].byteSize=10000000,
    x=>x.releases[0].contentType='image/svg+xml']) {
    const input=fixture();change(input);denied(input);
  }
});
test('duplicate, foreign and unapproved image IDs cannot cause partial public disclosure', () => {
  const input=fixture();input.association.imageIds.push(imageId);denied(input);
  const other=fixture();other.association.imageIds=['foreign-image-1234567890'];denied(other);
  const extra=fixture();extra.releases.push(extra.releases[0]);denied(extra);
});
test('empty gallery is permitted but cannot surface legacy raw URLs or private Chat images', () => {
  const input=fixture();input.association.imageIds=[];input.assets=[];input.releases=[];
  assert.deepEqual(project(input),{ok:true,images:[]});
  const legacy=fixture();legacy.association.imageIds=['https://res.cloudinary.com/secret'];denied(legacy);
});
test('getters and non-plain snapshot objects are rejected without running accessors', () => {
  const input=fixture();let called=0;
  Object.defineProperty(input.releases[0],'status',{get(){called++;throw Error('must not run');}});
  denied(input);assert.equal(called,0);
  const bad=fixture();bad.actor=Object.create({uid:'seller'});denied(bad);
});
