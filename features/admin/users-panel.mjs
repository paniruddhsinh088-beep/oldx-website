import {readLocalePreference} from '../i18n/preference.mjs';
import {createAdminApiClient} from './admin-api-client.mjs';
import {createProviderFirebaseSessionPorts} from '../service-providers/firebase-session-ports.mjs';

const userCopy=['User directory','User name','Status','Next page','Loading user directory…','User directory loaded.','No users found.','User directory access denied.','User directory unavailable.','Sign in to access the user directory.'];
const productCopy={
 en:['Product moderation list','Title','Category','Price','Next page','Loading products…','Products loaded.','No products found.','Product list access denied.','Product list unavailable.','Sign in to access the product list.'],
 gu:['પ્રોડક્ટ સમીક્ષા સૂચિ','શીર્ષક','શ્રેણી','કિંમત','આગળનું પેજ','પ્રોડક્ટ લોડ થઈ રહ્યાં છે…','પ્રોડક્ટ લોડ થઈ ગયાં.','કોઈ પ્રોડક્ટ મળ્યાં નથી.','પ્રોડક્ટ સૂચિની ઍક્સેસ નકારવામાં આવી.','પ્રોડક્ટ સૂચિ ઉપલબ્ધ નથી.','પ્રોડક્ટ સૂચિ જોવા સાઇન ઇન કરો.'],
 hi:['उत्पाद समीक्षा सूची','शीर्षक','श्रेणी','कीमत','अगला पेज','उत्पाद लोड हो रहे हैं…','उत्पाद लोड हो गए।','कोई उत्पाद नहीं मिला।','उत्पाद सूची की पहुँच अस्वीकृत है।','उत्पाद सूची उपलब्ध नहीं है।','उत्पाद सूची देखने के लिए साइन इन करें।']
};

// The session scopes browser work. The Admin endpoint alone authorizes reads.
function mountAdminList({enabled=false,root=document,auth,fetchImpl,products=false}={}){
 if(enabled!==true||auth?.app?.options?.projectId!=='oldx-staging')return null;
 const view=root.defaultView,section=root.getElementById(products?'adminAdsSection':'adminUsersSection');
 const body=root.getElementById(products?'adminAdsTableBody':'adminUsersTableBody');
 const status=products?root.createElement('p'):root.getElementById('adminBackendStatus');
 let storage;try{storage=view.localStorage;}catch{}
 const copy=products?productCopy[readLocalePreference(storage,root.documentElement.lang||'en')]:userCopy;
 const [title,...labels]=copy.slice(0,products?4:3);
 const [nextLabel,loading,loaded,empty,denied,unavailable,signIn]=copy.slice(products?4:3);
 if(products){status.setAttribute('role','status');section.prepend(status);}
 section.querySelector('h3').textContent=title;
 root.getElementById(products?'adminSearchAds':'adminSearchUsers').hidden=true;
  const header=section.querySelector('thead tr');
 header.replaceChildren(...labels.map(label=>{
  const cell=root.createElement('th');cell.scope='col';cell.className='p-3';cell.textContent=label;return cell;
 }));
 const next=root.createElement('button');next.type='button';next.textContent=nextLabel;next.hidden=true;section.append(next);
 let session=null,request=null,cursor=null,ports;
 const client=createAdminApiClient({fetchImpl,getIdToken:async()=> (await ports.getMediaToken(session)).token});
 function clear(){request?.abort();request=null;cursor=null;next.hidden=true;body.replaceChildren();}
 async function load(pageToken){
  clear();if(!session)return;
  const current=new AbortController(),user=auth.currentUser;request=current;status.textContent=loading;
  try{
   const data=await client.request(products?'products.list':'users.list',{pageSize:20,pageToken},{signal:current.signal});
   if(request!==current||auth.currentUser!==user)return;
   if(!Array.isArray(data.items)||data.items.length>20||data.nextPageToken!=null&&
      (typeof data.nextPageToken!=='string'||data.nextPageToken.length>512||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.nextPageToken)||data.nextPageToken===pageToken))throw Error('Invalid page');
   for(const item of data.items){
    const row=root.createElement('tr');
    for(const value of (products?[item?.title,item?.category,item?.finalPriceStr]:[item?.displayName,item?.status])){
     const cell=root.createElement('td');cell.className='p-3 break-words';cell.textContent=typeof value==='string'?value:'—';row.append(cell);
    }
    body.append(row);
   }
   cursor=data.nextPageToken??null;next.hidden=!cursor;status.textContent=data.items.length?loaded:empty;
  }catch(error){
   if(request!==current||auth.currentUser!==user)return;
   body.replaceChildren();
   status.textContent=error.status===401||error.status===403?denied:unavailable;
  }
 }
 ports=createProviderFirebaseSessionPorts({enabled:true,auth,sendCommand:()=>{},onSession:value=>{
  session=value;clear();status.textContent=signIn;
  // An Auth adapter may deliver its initial observer synchronously.
  if(value)queueMicrotask(()=>{if(session===value)load();});
 }});
 next.addEventListener('click',()=>{if(cursor)load(cursor);});
 view.addEventListener('pagehide',clear);
 const restore=event=>{if(event.persisted&&session)load();};
 view.addEventListener('pageshow',restore);
 const revalidate=event=>{if(products&&event.target===view&&session)load();};
 if(products)view.addEventListener('focus',revalidate);
 return Object.freeze({destroy(){ports.destroy();clear();next.remove();if(products)status.remove();view.removeEventListener('focus',revalidate);view.removeEventListener('pagehide',clear);view.removeEventListener('pageshow',restore);}});
}

export const mountAdminUsers=options=>mountAdminList({...options,products:false});
export const mountAdminProducts=options=>mountAdminList({...options,products:true});
