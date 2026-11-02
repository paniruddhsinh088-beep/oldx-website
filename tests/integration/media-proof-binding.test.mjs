import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaProofMatches} from '../../scripts/media-proof-binding.mjs';

const upload = Object.freeze({purpose:'upload',imageId:'image-opaque-000000000001',nonce:'nonce-opaque-000000000001',publicId:'oldx/quarantine/image-opaque-000000000001',sourceDigest:'a'.repeat(64),expectedRevision:1});
const deletion = Object.freeze({purpose:'delete',imageId:upload.imageId,nonce:'delete-opaque-000000000001',publicId:upload.publicId,assetId:'provider-asset',expectedRevision:3});

test('upload proof must echo every purpose, object, attempt, source and revision claim',()=>{
  const good={...upload,status:'present',byteSize:50};
  assert.equal(mediaProofMatches(good,upload),true);
  for(const [key,value] of Object.entries({purpose:'delete',imageId:'different',nonce:'different',publicId:'different',sourceDigest:'b'.repeat(64),expectedRevision:2,status:'unknown'})){
    assert.equal(mediaProofMatches({...good,[key]:value},upload),false,key);
  }
  assert.equal(mediaProofMatches({...good,status:'absent'},upload),true);
  assert.equal(mediaProofMatches({...good,sourceDigest:undefined},upload),false);
});

test('delete proof is bound to the exact provider asset and delete lease',()=>{
  const good={...deletion,status:'absent',definitive:true,operationSettled:true};
  assert.equal(mediaProofMatches(good,deletion),true);
  for(const [key,value] of Object.entries({purpose:'upload',imageId:'other',nonce:'other',publicId:'other',assetId:'other',expectedRevision:2,status:'unknown'})){
    assert.equal(mediaProofMatches({...good,[key]:value},deletion),false,key);
  }
  assert.equal(mediaProofMatches({...good,assetId:undefined},deletion),false);
});

test('malformed, accessor-backed, prototype-modified and revoked proof values fail closed',()=>{
  const good={...upload,status:'present'};
  for(const value of [null,undefined,[],Object.create(null),Object.assign(Object.create({x:1}),good),{...good,status:'unknown'}]){
    assert.equal(mediaProofMatches(value,upload),false);
  }
  const accessor={...good};Object.defineProperty(accessor,'imageId',{get(){throw Error('getter should not run')}});
  assert.equal(mediaProofMatches(accessor,upload),false);
  const {proxy,revoke}=Proxy.revocable(good,{});revoke();assert.equal(mediaProofMatches(proxy,upload),false);
});
