import {loadTranslator} from '../i18n/i18n.mjs';
import {createProductIntegration} from './product-integration.mjs';
const bindings=new WeakMap();
// Explicit existing-page mount only. There is no automatic activation, endpoint,
// token storage, SDK import or claim of live submission. Native hosts inject ports.
export async function readExistingProductForm({root=document,getCategory,readPhotoReferences}={}){
 const value=id=>root.getElementById(id)?.value??'';
 if(typeof getCategory!=='function'||typeof readPhotoReferences!=='function')throw new Error('Inactive form ports');
 const photos=await readPhotoReferences();
 return {title:value('adTitle'),description:value('adDesc'),category:getCategory(),locationLabel:[value('adDistrict'),value('adState')].filter(Boolean).join(', '),basePrice:Number(value('adPrice')),isSold:false,storeId:null,photos};
}
export function mountProductIntegration({root=document,enabled=false,ports,readProfile,translate=key=>key,...options}={}){
 bindings.get(root)?.destroy();if(enabled!==true)return Object.freeze({destroy(){}});
 const $=id=>root.getElementById(id),listeners=[],saved=[],view=root.defaultView;let model,enquiryMode=false,localeRevision=0,formRevision=0;
 const listen=(node,type,fn,options)=>{node?.addEventListener(type,fn,options);listeners.push(()=>node?.removeEventListener(type,fn,options));};
 function text(id,key){const n=$(id);if(n){n.dataset.i18n=key;n.textContent=translate(key);n.dispatchEvent(new view.Event('oldx:translate-ui',{bubbles:true}));}}
 function show(id){for(const v of ['homeView','sellWizardPage','productDetailView','fullChatPage'])if($(v))$(v).style.display=v===id?(id==='fullChatPage'?'flex':'block'):'none';}
 function resetForm(){for(const id of ['adTitle','adDesc','adPrice','adPhone','adImages'])if($(id))$(id).value='';if($('aiImagePreviewContainer')){$('aiImagePreviewContainer').replaceChildren();$('aiImagePreviewContainer').style.display='none';}}
 function resetPrivate(){if($('fullChatMessages'))$('fullChatMessages').replaceChildren();if($('fullChatInput'))$('fullChatInput').value='';}
 function status(state){text('productPortStatus','market.product.'+(state.command.status==='idle'?(state.statuses.detail??state.statuses.list??'idle'):state.command.status));
  const blocked=state.command.status==='loading'||state.command.canRetry;for(const id of ['adSubmitBtn','productSaveDraft','productWithdraw','productRemove','chatSendButton'])if($(id))$(id).disabled=blocked||!state.authenticated;
  if($('productNext'))$('productNext').disabled=!state.nextCursor||state.statuses.list==='loading';$('productEnquire').disabled=!state.detail||!state.authenticated;$('productOwnerInbox').disabled=!state.authenticated;
  $('productRetry').disabled=!state.command.canRetry;for(const id of ['productWithdraw','productRemove'])$(id).disabled=blocked||!state.owner;
  if($('fullChatInput'))$('fullChatInput').readOnly=blocked;
  $('productIntegrationPanel').setAttribute('aria-busy',String(state.command.status==='loading'));
  const grid=$('productGrid');if(grid){grid.replaceChildren();const query=($('searchInput')?.value??'').normalize('NFC').trim().toLocaleLowerCase();const matches=state.items.filter(p=>(p.title+' '+p.description).normalize('NFC').toLocaleLowerCase().includes(query));if(state.statuses.list==='ready'&&!matches.length){const p=root.createElement('p');p.textContent=translate('market.product.empty');grid.append(p);}for(const p of matches){const button=root.createElement('button');button.type='button';button.dataset.productId=p.id;button.className='text-left border rounded-xl p-3 min-w-0';const title=root.createElement('span'),price=root.createElement('span');title.textContent=p.title;price.textContent=new Intl.NumberFormat(root.documentElement.lang||'en',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(p.basePrice);title.style.overflowWrap='anywhere';title.style.display=price.style.display='block';button.append(title,price);grid.append(button);}}
  const p=state.detail;for(const [id,key] of [['detailTitle','title'],['detailDescription','description'],['detailLocation','locationLabel']])if($(id))$(id).textContent=p?.[key]??'';if($('detailPrice'))$('detailPrice').textContent=p?new Intl.NumberFormat(root.documentElement.lang||'en',{style:'currency',currency:'INR'}).format(p.basePrice):'';
  if($('inboxConversationsList')){$('inboxConversationsList').replaceChildren();for(const thread of state.inbox){const b=root.createElement('button');b.type='button';b.textContent=translate('market.product.conversation');b.addEventListener('click',()=>{enquiryMode=false;show('fullChatPage');model.loadThread(thread);$('fullChatInput').focus();});$('inboxConversationsList').append(b);}}
 }
 model=createProductIntegration({...options,enabled,ports,onChange:status,onPrivate:value=>{if(!value)resetPrivate();else $('fullChatMessages').replaceChildren();if(value)for(const message of value.messages){const p=root.createElement('p');p.textContent=message.text;p.style.overflowWrap='anywhere';p.dataset.senderRole=message.senderRole;$('fullChatMessages').append(p);}}});
 const panel=$('productIntegrationPanel');if(!panel)throw new Error('Existing Product integration controls unavailable');panel.hidden=false;$('productEnquire').hidden=false;$('productPortStatus').hidden=false;$('productNext').hidden=false;for(const id of ['adPhone','adImages']){const node=$(id);if(node){const was=node.required;saved.push(()=>node.required=was);node.required=false;}}
 // Capability gaps stay visibly unavailable. They never fall through to legacy
 // contact, upload, voice, map or payment handlers under a trusted mount.
 for(const node of root.querySelectorAll('#fullChatPage [onclick], #productDetailView [onclick], #productDetailView a'))if(node.id!=='chatSendButton'){const was=node.hidden;saved.push(()=>node.hidden=was);node.hidden=true;}
 const form=$('adSubmitBtn')?.closest('form');listen(form,'submit',event=>{event.preventDefault();event.stopImmediatePropagation();save('publish');},true);
 async function save(publication){const version=formRevision;try{const profile=await (readProfile?readProfile():readExistingProductForm({root,...options}));if(version!==formRevision)return;if(publication==='publish'&&(!Array.isArray(profile?.photos)||profile.photos.length===0))throw new Error('Photos required');await model.save(profile,publication);}catch{text('productPortStatus','market.product.photosUnavailable');}}
 listen($('productSaveDraft'),'click',()=>save('draft'));listen($('productWithdraw'),'click',()=>save('withdraw'));listen($('productRemove'),'click',()=>model.archive());listen($('productRetry'),'click',()=>model.retry());
 listen($('productNext'),'click',()=>model.nextPage());listen($('productDiscover'),'click',()=>{show('homeView');model.discover();});listen($('productOwnerInbox'),'click',()=>{enquiryMode=false;$('inboxModal').style.display='flex';model.loadInbox('seller');});
 listen($('productEnquire'),'click',()=>{enquiryMode=true;show('fullChatPage');$('fullChatInput').focus();});
 listen($('productGrid'),'click',event=>{const button=event.target.closest('[data-product-id]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();show('productDetailView');model.openProduct(button.dataset.productId);},true);
 async function send(event){event.preventDefault();event.stopImmediatePropagation();const value=$('fullChatInput').value;if(enquiryMode)await model.enquire(value);else await model.reply(value);const state=model.snapshot();if(state.command.status==='saved'&&state.thread){enquiryMode=false;await model.loadThread(state.thread);}}
 listen($('chatSendButton'),'click',send,true);listen($('fullChatInput'),'keydown',event=>{if(event.key==='Enter'&&!event.isComposing)send(event);},true);
 listen($('searchInput'),'input',event=>{event.stopImmediatePropagation();formRevision++;model.changeScope();model.discover();},true);
 for(const type of ['popstate','hashchange'])listen(view,type,()=>{formRevision++;model.changeScope();show('homeView');});listen(root,'oldx:locale-changed',async event=>{const version=++localeRevision;const catalog=await loadTranslator(event.detail?.locale);if(version===localeRevision){translate=key=>catalog.t(key);status(model.snapshot());}});listen(view,'pagehide',()=>{formRevision++;model.clear();});listen(view,'offline',()=>{formRevision++;model.setOnline(false);});listen(view,'online',()=>model.setOnline(true));
 const api=Object.freeze({model,setSession:value=>{formRevision++;model.setSession(value);resetPrivate();resetForm();},show,destroy(){formRevision++;localeRevision++;listeners.forEach(remove=>remove());model.clear();resetForm();saved.forEach(restore=>restore());panel.hidden=true;$('productEnquire').hidden=true;$('productPortStatus').hidden=true;$('productNext').hidden=true;bindings.delete(root);}});bindings.set(root,api);status(model.snapshot());return api;
}
