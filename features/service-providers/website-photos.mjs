import {compressProviderPhoto} from '../media/compress-provider-photo.mjs';
// Compressed selections are ephemeral; explicit host ports enable authenticated
// quarantine upload and atomic private references, never client-side approval.
export function mountWebsiteProviderPhotos({root=document,translate,onChange=()=>{}}={}){
 const panel=root.createElement('section');panel.className='profile-section';panel.id='websiteProviderPhotos';let epoch=0,busy=false,items=[],active=true,client=null,scope=null,pendingReference=null,pendingRemoval=null;const urls=new Set(),inputs=[];
 const status=root.createElement('p');status.setAttribute('role','status');status.style.overflowWrap='anywhere';let statusKey='website.photosInactive';
 const gallery=root.createElement('div');gallery.className='preview-share-actions';const heading=root.createElement('h3');panel.append(heading,status);
 for(const role of ['profile','work']){const label=root.createElement('label'),text=root.createElement('span'),input=root.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.multiple=role==='work';input.dataset.photoRole=role;label.className='field';label.append(text,input);panel.append(label);inputs.push({input,text,role});input.addEventListener('change',()=>change(input,role));}
 const controls=root.createElement('div'),select=root.createElement('select'),upload=root.createElement('button');
 select.style.maxWidth='100%';select.style.minWidth='0';select.style.minHeight='44px';select.style.font='inherit';upload.style.maxWidth='100%';upload.style.whiteSpace='normal';upload.style.overflowWrap='anywhere';select.setAttribute('aria-label',translate('website.workService'));upload.type='button';upload.className='btn';upload.dataset.providerPhotoUpload='true';controls.className='preview-share-actions';controls.append(select,upload);panel.append(controls,gallery);
 upload.addEventListener('click',send);
 select.addEventListener('change',()=>{if(!busy&&!pendingReference)render();});
 root.getElementById('providerForm').insertBefore(panel,root.getElementById('providerIntegrationPanel'));
 function render(){upload.textContent=translate(pendingReference?'media.retry':'website.uploadPhotos');upload.disabled=busy||!client||!scope||!items.length;select.disabled=busy||!!pendingReference||!scope;select.setAttribute('aria-label',translate('website.workService'));for(const o of select.options)if(o.value==='')o.textContent=translate('website.workService');controls.hidden=!client;heading.textContent=translate('website.photos');for(const {input,text,role}of inputs){text.textContent=translate(role==='profile'?'website.profilePhoto':'website.workPhoto');input.setAttribute('aria-label',text.textContent);input.disabled=busy||!!pendingReference;}status.textContent=translate(statusKey);gallery.replaceChildren();items.forEach(item=>{const row=root.createElement('div'),img=root.createElement('img'),remove=root.createElement('button'),label=root.createElement('span');img.src=item.url;img.alt=translate(item.role==='profile'?'website.profilePhoto':'website.workPhoto');img.width=100;img.height=100;img.style.objectFit='cover';label.textContent=img.alt;remove.type='button';remove.className='btn';remove.textContent=translate('media.remove');remove.disabled=busy||!!pendingReference;remove.addEventListener('click',()=>item.done?detach(item):removeLocal(item));row.append(img,label,remove);gallery.append(row);});onChange();}
 async function change(input,role){const files=Array.from(input.files??[]);input.value='';if(busy||pendingReference||!files.length)return;if(role==='profile'&&files.length!==1||role==='work'&&items.filter(v=>v.role==='work').length+files.length>6){statusKey='website.photoLimit';render();return;}const version=epoch;busy=true;statusKey='website.photoProcessing';render();const prepared=[];
 try{for(const file of files){const compressed=await compressProviderPhoto(file);if(!active||version!==epoch)return;prepared.push(compressed);}if(role==='profile'){for(const item of items.filter(v=>v.role==='profile')){URL.revokeObjectURL(item.url);urls.delete(item.url);}items=items.filter(v=>v.role!=='profile');}for(const file of prepared){const url=URL.createObjectURL(file);urls.add(url);items.push({file,url,role});}statusKey='website.photosInactive';}catch{statusKey='website.photoError';}finally{if(active&&version===epoch){busy=false;render();}}}
 function removeLocal(item){URL.revokeObjectURL(item.url);urls.delete(item.url);items=items.filter(v=>v!==item);render();}
 async function detach(item){
  if(busy||pendingReference||!client||!scope)return;busy=true;const version=epoch;statusKey='website.photoUploading';render();
  try{const base={kind:'provider',parentId:scope.parentId,service:item.service,expectedParentRevision:scope.revision},existing=await client.ownerReferences(base);if(version!==epoch)return;if(!existing.ok)throw Error('UNAVAILABLE');pendingReference={...base,requestId:root.defaultView.crypto.randomUUID(),expectedPhotoRevision:existing.photoRevision,imageIds:existing.photos.map(v=>v.imageId).filter(v=>v!==item.imageId)};pendingRemoval=item;const result=await client.references(pendingReference);if(version!==epoch)return;if(!result.ok)throw Error(result.code);pendingReference=null;pendingRemoval=null;removeLocal(item);statusKey='website.photosQuarantined';}
  catch{if(version===epoch)statusKey='website.photoUploadFailed';}finally{if(version===epoch){busy=false;render();}}
 }
 async function send(){
  if(busy||!client||!scope||!items.length)return;
  const version=epoch,selectedService=select.value,currentClient=client,currentScope={...scope};
  if(items.some(v=>v.role==='work'&&!v.done)&&!selectedService){statusKey='website.chooseWorkService';render();return;}
  busy=true;statusKey='website.photoUploading';render();
  const live=()=>active&&version===epoch;
  try{
   if(pendingReference){const done=await currentClient.references(pendingReference);if(!live())return;if(!done.ok)throw Error(done.code);for(const item of items)if(pendingReference.imageIds.includes(item.imageId)){item.done=true;item.service=pendingReference.service;}pendingReference=null;if(pendingRemoval){removeLocal(pendingRemoval);pendingRemoval=null;}}
   for(const service of [null,selectedService]){
    const selected=items.filter(v=>!v.done&&(service===null?v.role==='profile':v.role==='work'));if(!selected.length)continue;
    const base={kind:'provider',parentId:currentScope.parentId,service,expectedParentRevision:currentScope.revision};
    const existing=await currentClient.ownerReferences(base);if(!live())return;if(!existing.ok)throw Error(existing.code);
    for(const item of selected){if(item.imageId)continue;item.requestId??=root.defaultView.crypto.randomUUID();const bytes=new Uint8Array(await item.file.arrayBuffer());if(!live())return;const result=await currentClient.upload({...base,requestId:item.requestId,bytes,contentType:item.file.type});if(!live())return;if(!result.ok)throw Error(result.code);item.imageId=result.imageId;}
    const imageIds=service===null?selected.map(v=>v.imageId):[...new Set([...existing.photos.map(v=>v.imageId),...selected.map(v=>v.imageId)])];
    if(imageIds.length>(service===null?1:6))throw Error('LIMIT');
    pendingReference={...base,requestId:root.defaultView.crypto.randomUUID(),expectedPhotoRevision:existing.photoRevision,imageIds};
    const attached=await currentClient.references(pendingReference);if(!live())return;if(!attached.ok)throw Error(attached.code);pendingReference=null;for(const item of selected){item.done=true;item.service=service;}
   }
   statusKey='website.photosQuarantined';
  }catch{if(live())statusKey='website.photoUploadFailed';}finally{if(live()){busy=false;render();}}
 }
 function setScope(value){const next=value&&{uid:value.uid,sessionId:value.sessionId,parentId:value.parentId,revision:value.revision};if(JSON.stringify(next)!==JSON.stringify(scope)){epoch++;busy=false;pendingReference=null;pendingRemoval=null;for(const item of items){delete item.requestId;delete item.imageId;delete item.done;}scope=next;client?.setScope(next);}const selected=select.value;select.replaceChildren();const placeholder=root.createElement('option');placeholder.value='';placeholder.textContent=translate('website.workService');select.append(placeholder);for(const service of value?.services??[]){const option=root.createElement('option');option.value=service;option.textContent=service;select.append(option);}select.value=selected;render();}
 function clear(){epoch++;scope=null;client?.setScope(null);pendingReference=null;pendingRemoval=null;for(const url of urls)URL.revokeObjectURL(url);urls.clear();items=[];busy=false;statusKey='website.photosInactive';if(active)render();}
 root.defaultView.addEventListener('pagehide',clear);render();
 return Object.freeze({render,clear,setScope,configure(value){client?.setScope(null);client=value??null;scope=null;pendingReference=null;epoch++;busy=false;render();},hasProfile:()=>items.some(v=>v.role==='profile')&&!busy,prepared:()=>items.map(v=>({role:v.role,file:v.file})),destroy(){clear();active=false;root.defaultView.removeEventListener('pagehide',clear);panel.remove();}});
}
