import {createAdminApiClient} from './admin-api-client.mjs';
import {createProviderFirebaseSessionPorts} from '../service-providers/firebase-session-ports.mjs';

// The session scopes browser work. The Admin endpoint alone authorizes reads.
export function mountAdminUsers({enabled=false,root=document,auth,fetchImpl}={}){
 if(enabled!==true||auth?.app?.options?.projectId!=='oldx-staging')return null;
 const section=root.getElementById('adminUsersSection'),body=root.getElementById('adminUsersTableBody');
 const status=root.getElementById('adminBackendStatus'),heading=section.querySelector('h3');
 heading.textContent='User directory';
 root.getElementById('adminSearchUsers').hidden=true;
 const header=section.querySelector('thead tr');
 header.replaceChildren(...['User name','Status'].map(label=>{
  const cell=root.createElement('th');cell.scope='col';cell.className='p-3';cell.textContent=label;return cell;
 }));
 const next=root.createElement('button');next.type='button';next.textContent='Next page';next.hidden=true;section.append(next);
 let session=null,request=null,cursor=null,ports;
 const client=createAdminApiClient({fetchImpl,getIdToken:async()=> (await ports.getMediaToken(session)).token});
 function clear(){request?.abort();request=null;cursor=null;next.hidden=true;body.replaceChildren();}
 async function load(pageToken){
  clear();if(!session)return;
  const current=new AbortController(),user=auth.currentUser;request=current;status.textContent='Loading user directory…';
  try{
   const data=await client.request('users.list',{pageSize:20,pageToken},{signal:current.signal});
   if(request!==current||auth.currentUser!==user)return;
   if(!Array.isArray(data.items)||data.items.length>20||data.nextPageToken!=null&&
      (typeof data.nextPageToken!=='string'||data.nextPageToken.length>4096))throw Error('Invalid page');
   for(const item of data.items){
    const row=root.createElement('tr');
    for(const value of [item?.displayName,item?.status]){
     const cell=root.createElement('td');cell.className='p-3 break-words';cell.textContent=typeof value==='string'?value:'—';row.append(cell);
    }
    body.append(row);
   }
   cursor=data.nextPageToken??null;next.hidden=!cursor;status.textContent=data.items.length?'User directory loaded.':'No users found.';
  }catch(error){
   if(request!==current||auth.currentUser!==user)return;
   body.replaceChildren();
   status.textContent=error.status===401||error.status===403?'User directory access denied.':'User directory unavailable.';
  }
 }
 ports=createProviderFirebaseSessionPorts({enabled:true,auth,sendCommand:()=>{},onSession:value=>{
  session=value;clear();status.textContent='Sign in to access the user directory.';
  // An Auth adapter may deliver its initial observer synchronously.
  if(value)queueMicrotask(()=>{if(session===value)load();});
 }});
 next.addEventListener('click',()=>{if(cursor)load(cursor);});
 const view=root.defaultView;
 view.addEventListener('pagehide',clear);
 const restore=event=>{if(event.persisted&&session)load();};
 view.addEventListener('pageshow',restore);
 return Object.freeze({destroy(){ports.destroy();clear();next.remove();view.removeEventListener('pagehide',clear);view.removeEventListener('pageshow',restore);}});
}
