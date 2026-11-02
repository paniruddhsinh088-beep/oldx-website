// Shared plain-text schema only. Never proves membership or authorizes a send.
export function normalizeMessageDraft(value) {
 if(typeof value!=='string'||value.length>2000||!value.trim()||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value))return null;
 const normalized=value.normalize('NFC').trim();
 return normalized.length<=2000?normalized:null;
}
