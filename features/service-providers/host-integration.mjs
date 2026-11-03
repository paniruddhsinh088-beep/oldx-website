const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const scope=v=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')==='enquiryId,providerId'&&id(v.providerId)&&id(v.enquiryId);
// Adapt the existing page controllers to the existing marketplace navigation.
// A native/web host supplies openPage; no location, storage, transport or Auth.
// URL IDs/audience are presentation hints, never authorization or identity.
export function createProviderHost({enabled=false,audience='buyer',publicPage,inbox,conversation,openPage}={}){
 if(!['buyer','provider'].includes(audience))throw new TypeError('Invalid Provider audience');
 const pages=[publicPage,inbox,conversation].filter(Boolean);
 function changeScope(){if(!enabled)return;for(const page of pages)page.changeScope?.();}
 function open(page,hash){if(!enabled||typeof openPage!=='function')return false;changeScope();return openPage({page,hash});}
 const navigation=Object.freeze({changeScope,
  discover(){if(!enabled)return false;return publicPage?publicPage.discover():open('service-preview.html','#services');},
  detail(value){if(!enabled||!id(value?.providerId))return false;return publicPage?publicPage.detail(value):open('service-preview.html','#provider/'+value.providerId);},
  openEnquiry(providerId){if(!enabled||!id(providerId))return false;return publicPage?publicPage.openEnquiry(providerId):open('service-preview.html','#provider/'+providerId);},
  openInbox(value){if(!enabled)return false;if(typeof value!=='string'&&!scope(value))return false;const v=typeof value==='string'?{providerId:value,enquiryId:null}:value;if(!id(v.providerId))return false;return inbox?inbox.open(v):open('service-inbox-preview.html','#inbox/'+v.providerId+(v.enquiryId?'/enquiry/'+v.enquiryId:''));},
  openConversation(value){if(!enabled||!scope(value))return false;return conversation?conversation.open(value):open('service-conversation-preview.html','#conversation/'+audience+'/'+value.providerId+'/'+value.enquiryId);}
 });
 const journey=Object.freeze({changeScope,async setSession(value){if(!enabled)return false;try{await Promise.all(pages.map(async page=>{const result=await page.setSession(value&&page!==publicPage?{uid:value.uid,sessionId:value.sessionId}:value);if(result===false)throw new Error('Unavailable Provider session');}));return true;}catch{await Promise.allSettled(pages.map(page=>page.setSession(null)));return false;}}});
 return Object.freeze({navigation,journey,changeScope,setSession:journey.setSession});
}
