import {demoProviders} from './preview-fixtures.mjs';
import {createSampleInbox,createSampleBuyerInbox,SAMPLE_BUYERS} from './preview-inbox-fixtures.mjs';
import {buildSampleInbox,readSampleInboxDetail,changeSampleEnquiry,SAMPLE_ENQUIRY_STATES,SAMPLE_PROVIDER_ACTIONS,isSampleReply,buildSampleBuyerInbox,sampleBuyerActions} from './preview-inbox-model.mjs';
import {parseSampleInboxRoute,parseSampleBuyerRoute} from './preview-inbox-route.mjs';
import {createTranslator,loadTranslator,SUPPORTED_LOCALES} from '../i18n/i18n.mjs';
import {applyCatalog} from '../i18n/dom.mjs';import {readLocalePreference,writeLocalePreference} from '../i18n/preference.mjs';
const $=id=>document.getElementById(id);let translator=createTranslator('en'),localeRevision=0;
const t=(key,params)=>translator.t(key,params);let context=null,providerId=null,enquiryId=null,replyDraft='',feedbackKey=null,lastHash=null;
const buyerMode=document.documentElement.dataset.audience==='buyer';
let buyerId=null,pendingConfirmation=null,viewRevision=0;let history=[];
const parseRoute=hash=>buyerMode?parseSampleBuyerRoute(hash):parseSampleInboxRoute(hash);
const routeUrl=(id,enquiry=null)=> (buyerMode?'#buyer/'+buyerId+'/provider/':'#inbox/')+id+(enquiry?'/enquiry/'+enquiry:'');
const withdrawn=new Set();const storage=()=>{try{return localStorage;}catch{return null;}};
const actor=()=>({role:buyerMode?'buyer':'provider',id:buyerMode?buyerId:providerId});
function option(value,label){const node=document.createElement('option');node.value=value;node.textContent=label;return node;}
if(buyerMode)for(const id of SAMPLE_BUYERS)$('sampleBuyer').append(option(id,id));
for(const provider of demoProviders)$('sampleProvider').append(option(provider.id,provider.name));
function clearDetail(){for(const id of ['detailHeading','detailStatus','detailNote','detailReply'])$(id).textContent='';$('inboxReply').value='';$('inboxActions').replaceChildren();$('inboxBack').removeAttribute('href');$('conversationLink').removeAttribute('href');$('buyerConfirmation')?.setAttribute('hidden','');$('sampleHistory')?.replaceChildren();}
let trustedPrivateMode=document.documentElement.dataset.providerPrivate==='true';document.addEventListener('oldx:provider-private-mode',event=>{trustedPrivateMode=event.detail?.enabled===true;if(trustedPrivateMode){context=null;replyDraft='';history=[];clearDetail();}});
function render(focus=false,restore=false){
 if(trustedPrivateMode)return;
 const route=parseRoute(location.hash),previousEnquiry=enquiryId;
 if(providerId!==route?.providerId || buyerMode&&buyerId!==route?.buyerId || !context){buyerId=route?.buyerId??null;history=[];pendingConfirmation=null;context=buyerMode?(SAMPLE_BUYERS.includes(buyerId)?createSampleBuyerInbox(route?.providerId):null):createSampleInbox(route?.providerId);providerId=route?.providerId??null;replyDraft='';enquiryId=null;$('inboxStatus').value='all';$('inboxService').replaceChildren();}
 if(context)context.provider.published=!withdrawn.has(providerId);
 enquiryId=route?.enquiryId??null;if(enquiryId!==previousEnquiry)pendingConfirmation=null;
 if(buyerMode)$('sampleBuyer').value=buyerId??'';
 const status=$('inboxStatus').value||'all',service=$('inboxService').value||'all';
 $('inboxStatus').replaceChildren(option('all',t('inbox.all')),...SAMPLE_ENQUIRY_STATES.map(s=>option(s,t('inbox.state.'+s.replaceAll('-','_')))));$('inboxStatus').value=status;
 $('inboxService').replaceChildren(option('all',t('inbox.all')),...(context?.provider.services??[]).map(s=>option(s,s)));$('inboxService').value=service;
 $('sampleProvider').value=providerId??'';$('withdrawProvider').checked=withdrawn.has(providerId);
 $('sampleProviderName').textContent=context?.provider.name??'';
 clearDetail();$('inboxRows').replaceChildren();$('inboxCount').textContent='';
 const list=(buyerMode?buildSampleBuyerInbox:buildSampleInbox)(context,actor(),{status,service});const found=enquiryId?readSampleInboxDetail(context,actor(),enquiryId):null;
 const valid=list.ok&&(!enquiryId||found.ok);
 $('inboxList').hidden=!valid||!!enquiryId;$('inboxDetail').hidden=!valid||!enquiryId;$('inboxUnavailable').hidden=valid;
 let target=$('unavailableHeading');
 if(valid&&!enquiryId){
  replyDraft='';$('inboxEmpty').hidden=list.items.length>0;$('inboxCount').textContent=t('inbox.count',{count:list.items.length});
  for(const row of list.items){const card=document.createElement('article');card.className='card';const link=document.createElement('a');link.href=routeUrl(providerId,row.id);link.dataset.enquiryId=row.id;link.textContent=row.service+' · '+row.id;const status=document.createElement('p');status.textContent=t('inbox.state.'+row.status.replaceAll('-','_'));card.append(link,status);$('inboxRows').append(card);}
  target=restore?[...document.querySelectorAll('#inboxRows a')].find(a=>a.dataset.enquiryId===previousEnquiry)??$('inboxHeading'):$('inboxHeading');
 }else if(valid){
  const row=found.record;if(previousEnquiry!==enquiryId)replyDraft=row.reply;
  $('detailHeading').textContent=row.service+' · '+row.id;$('detailStatus').textContent=t('inbox.state.'+row.status.replaceAll('-','_'));$('detailNote').textContent=row.note;$('detailReply').textContent=row.reply;$('inboxReply').value=replyDraft;$('inboxReply').setAttribute('aria-invalid',String(feedbackKey==='inbox.replyError'));
  $('inboxBack').href=routeUrl(providerId);$('conversationLink').href='./service-conversation-preview.html#conversation/'+(buyerMode?'buyer':'provider')+'/'+providerId+'/'+row.id;
  for(const [action,states] of (buyerMode?sampleBuyerActions(context,actor(),row.id).map(action=>[action,[row.status]]):Object.entries(SAMPLE_PROVIDER_ACTIONS))){if(action==='reply'||!states.includes(row.status))continue;const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=t('inbox.action.'+action.replaceAll('-','_'));button.addEventListener('click',()=>{if(buyerMode&&action==='confirm-completion'){pendingConfirmation={id:row.id,providerId:row.providerId,revision:row.revision};$('buyerConfirmation').hidden=false;$('confirmBuyerSample').focus();}else change(row,action);});$('inboxActions').append(button);}
  const canReply=!buyerMode&&SAMPLE_PROVIDER_ACTIONS.reply.includes(row.status);$('inboxReply').disabled=$('previewReply').disabled=!canReply;target=$('detailHeading');
  if(buyerMode){$('sampleReplyForm').hidden=true;for(const event of history.filter(e=>e.id===row.id)){const item=document.createElement('li');item.textContent=t('inbox.state.'+event.from.replaceAll('-','_'))+' → '+t('inbox.state.'+event.to.replaceAll('-','_'));$('sampleHistory').append(item);}if(!history.some(e=>e.id===row.id)){const item=document.createElement('li');item.textContent=t('buyer.seedHistory');$('sampleHistory').append(item);}if(pendingConfirmation?.id===row.id&&pendingConfirmation.revision===row.revision)$('buyerConfirmation').hidden=false;}
 }else{replyDraft='';$('sampleProviderName').textContent='';}
 $('inboxFeedback').textContent=feedbackKey?t(feedbackKey):'';
 if(buyerMode){$('buyerLoading').hidden=true;$('inboxList').setAttribute('aria-busy','false');$('inboxDetail').setAttribute('aria-busy','false');}
 if(focus){target.focus();window.scrollTo({top:0,behavior:'instant'});}
}
function change(row,action,reply){
 const active=parseRoute(location.hash);if(active?.providerId!==row.providerId || active?.enquiryId!==row.id || buyerMode&&active?.buyerId!==buyerId){pendingConfirmation=null;replyDraft='';clearDetail();$('inboxDetail').hidden=true;$('inboxUnavailable').hidden=false;$('unavailableHeading').focus();return;}
 const result=changeSampleEnquiry(context,actor(),{providerId:row.providerId,id:row.id,revision:row.revision,action,...(action==='reply'?{reply}:{})});
 if(!result.ok){feedbackKey='inbox.changed';replyDraft='';clearDetail();$('inboxDetail').hidden=true;$('inboxUnavailable').hidden=false;$('unavailableHeading').focus();$('inboxFeedback').textContent=t(feedbackKey);return;}
 const previous=context.records.find(r=>r.id===row.id);if(buyerMode){history.push({id:row.id,from:previous.status,to:result.context.records.find(r=>r.id===row.id).status});history=history.slice(-32);}pendingConfirmation=null;context=result.context;replyDraft=context.records.find(r=>r.id===row.id).reply;feedbackKey='inbox.updated';render(true);
}
function routeChanged(){if(lastHash===location.hash)return;lastHash=location.hash;feedbackKey=null;pendingConfirmation=null;refreshRoute(true,true);}
window.addEventListener('hashchange',routeChanged);window.addEventListener('popstate',routeChanged);
$('sampleProvider').addEventListener('change',()=>{location.hash=routeUrl($('sampleProvider').value);});
$('withdrawProvider').addEventListener('change',()=>{if($('withdrawProvider').checked)withdrawn.add(providerId);else withdrawn.delete(providerId);context=null;replyDraft='';feedbackKey=null;render(true);});
for(const id of ['inboxStatus','inboxService'])$(id).addEventListener('change',()=>{feedbackKey=null;render();});
$('inboxFilters').addEventListener('submit',e=>e.preventDefault());$('inboxReply').addEventListener('input',()=>{replyDraft=$('inboxReply').value;if(feedbackKey==='inbox.replyError'){feedbackKey=null;$('inboxFeedback').textContent='';$('inboxReply').setAttribute('aria-invalid','false');}});
$('sampleReplyForm').addEventListener('submit',e=>{e.preventDefault();const found=readSampleInboxDetail(context,actor(),enquiryId);if(!found.ok)return;if(!isSampleReply(replyDraft)){feedbackKey='inbox.replyError';$('inboxFeedback').textContent=t(feedbackKey);$('inboxReply').setAttribute('aria-invalid','true');$('inboxReply').focus();return;}change(found.record,'reply',replyDraft);});
$('main').parentElement.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();$('main').focus();});
async function selectLocale(code,persist=false){const version=++localeRevision;let next,failed=false;try{next=await loadTranslator(code);}catch{next=createTranslator('en');failed=true;}if(version!==localeRevision)return;translator=next;applyCatalog(document,translator);$('localeSelect').value=translator.locale;$('localeStatus').textContent=failed?t('languageUnavailable'):t('languageChanged',{language:SUPPORTED_LOCALES.find(l=>l.code===translator.locale).name});if(persist&&!failed)writeLocalePreference(storage(),translator.locale);render();}
$('localeSelect').addEventListener('change',e=>selectLocale(e.target.value,true));
window.addEventListener('pagehide',()=>{viewRevision++;history=[];pendingConfirmation=null;context=null;replyDraft='';feedbackKey=null;clearDetail();$('inboxRows').replaceChildren();$('inboxCount').textContent='';});
window.addEventListener('pageshow',e=>{if(e.persisted)render();});
function refreshRoute(focus=false,restore=false){
 const version=++viewRevision;
 if(!buyerMode){render(focus,restore);return;}
 clearDetail();$('inboxRows').replaceChildren();$('buyerLoading').hidden=false;$('inboxList').setAttribute('aria-busy','true');$('inboxDetail').setAttribute('aria-busy','true');
 // Bounded in-memory preparation, not a remote read. Revision suppresses older
 // queued renders after scope changes/page-hide; locale uses current scope.
 queueMicrotask(()=>{if(version===viewRevision)render(focus,restore);});
}
if(buyerMode){
 $('sampleBuyer').addEventListener('change',()=>{location.hash='#buyer/'+$('sampleBuyer').value+'/provider/'+providerId;});
 $('confirmBuyerSample').addEventListener('click',()=>{if(pendingConfirmation)change(pendingConfirmation,'confirm-completion');});
 $('cancelBuyerConfirmation').addEventListener('click',()=>{pendingConfirmation=null;$('buyerConfirmation').hidden=true;$('detailHeading').focus();});
}
await selectLocale(readLocalePreference(storage(),'gu'));lastHash=location.hash;
