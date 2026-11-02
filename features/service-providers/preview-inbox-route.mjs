// Sample IDs only; no database path, private note, reply or actor in a URL.
export function parseSampleInboxRoute(hash){
 if(hash===''||hash==='#')return {providerId:'p1',enquiryId:null};
 if(typeof hash!=='string'||hash.length>240)return null;
 const match=/^#inbox\/([A-Za-z0-9_-]{1,100})(?:\/enquiry\/([A-Za-z0-9_-]{1,100}))?$/.exec(hash);
 return match?{providerId:match[1],enquiryId:match[2]??null}:null;
}
