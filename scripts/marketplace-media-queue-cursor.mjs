import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

export const isMarketplaceMediaAssetId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{20,80}$/.test(value);

const version='mq1';
const nonceSize=12,tagSize=16,plaintextSize=88;
const tokenSize=nonceSize+tagSize+plaintextSize;
const associatedData=scope=>Buffer.from(`oldx:marketplace-media-queue:${version}:${scope}`);

// Emulator callers supply a dedicated synthetic key. Replacing it invalidates
// outstanding cursors; callers can restart pagination from the first page.
export function createMarketplaceMediaQueueCursor({key,now=Date.now,ttlMs=60000}={}){
 if(!(key instanceof Uint8Array)||key.byteLength!==32||!Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>300000)return null;
 const secret=Buffer.from(key);
 return Object.freeze({
  issue(after,scope){
   const issuedAt=now();
   if(!isMarketplaceMediaAssetId(after)||!Number.isSafeInteger(issuedAt)||issuedAt<0)throw new Error('Cursor unavailable');
   const plaintext=Buffer.alloc(plaintextSize);
   plaintext.writeBigUInt64BE(BigInt(issuedAt));
   // Fixed width keeps the skipped asset ID length out of the wire format.
   plaintext.write(after,8,'ascii');
   const nonce=randomBytes(nonceSize);
   const cipher=createCipheriv('aes-256-gcm',secret,nonce,{authTagLength:tagSize});
   cipher.setAAD(associatedData(scope));
   const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
   return version+'.'+Buffer.concat([nonce,ciphertext,cipher.getAuthTag()]).toString('base64url');
  },
  read(token,scope){
   try{
    if(typeof token!=='string'||!/^mq1\.[A-Za-z0-9_-]{155}$/.test(token))return null;
    const encoded=token.slice(version.length+1),packed=Buffer.from(encoded,'base64url');
    if(packed.length!==tokenSize||packed.toString('base64url')!==encoded)return null;
    const decipher=createDecipheriv('aes-256-gcm',secret,packed.subarray(0,nonceSize),{authTagLength:tagSize});
    decipher.setAAD(associatedData(scope));
    decipher.setAuthTag(packed.subarray(-tagSize));
    const plaintext=Buffer.concat([decipher.update(packed.subarray(nonceSize,-tagSize)),decipher.final()]);
    const issuedAt=Number(plaintext.readBigUInt64BE()),age=now()-issuedAt;
    if(!Number.isSafeInteger(issuedAt)||!Number.isSafeInteger(age)||age<0||age>=ttlMs)return null;
    const after=plaintext.toString('utf8',8).replace(/\0+$/,'');
    return isMarketplaceMediaAssetId(after)?after:null;
   }catch{return null;}
  }
 });
}
