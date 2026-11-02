import {createHmac,timingSafeEqual} from 'node:crypto';
// Inactive server-only codec; key must come from an approved secret manager.
// No key generation/storage/provisioning. Tests use explicitly synthetic bytes.
export function createProviderDiscoveryCursorCodec({key,now=Date.now,ttlMs=60000}={}){
 if(!(key instanceof Uint8Array)||key.length<32||key.length>128||!Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>300000)throw new TypeError('Invalid cursor configuration');
 const secret=Buffer.from(key),sign=body=>createHmac('sha256',secret).update(body).digest();
 return Object.freeze({
  issueCursor(state){const body=Buffer.from(JSON.stringify({v:1,issuedAt:now(),state})).toString('base64url');const token=body+'.'+sign(body).toString('base64url');if(token.length>1024)throw new TypeError('Cursor exceeds bound');return token;},
  readCursor(token){try{
   if(typeof token!=='string'||token.length>1024||!token.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/))return null;
   const [body,signature]=token.split('.'),actual=Buffer.from(signature,'base64url'),expected=sign(body);
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected)||actual.toString('base64url')!==signature)return null;
   const decoded=JSON.parse(Buffer.from(body,'base64url').toString('utf8')),age=now()-decoded.issuedAt;
   if(decoded.v!==1||!Number.isSafeInteger(decoded.issuedAt)||age<0||age>=ttlMs||Object.keys(decoded).sort().join(',')!=='issuedAt,state,v')return null;
   return decoded.state;
  }catch{return null;}}
 });
}
