import {demoProviders} from './preview-fixtures.mjs';
import {createSampleInbox} from './preview-inbox-fixtures.mjs';
import {buildSampleInbox,readSampleInboxDetail,changeSampleEnquiry,SAMPLE_ENQUIRY_STATES,SAMPLE_PROVIDER_ACTIONS,isSampleReply} from './preview-inbox-model.mjs';
import {parseSampleInboxRoute} from './preview-inbox-route.mjs';
import {createTranslator,loadTranslator,SUPPORTED_LOCALES} from '../i18n/i18n.mjs';
import {applyCatalog} from '../i18n/dom.mjs';import {readLocalePreference,writeLocalePreference} from '../i18n/preference.mjs';
const $=id=>document.getElementById(id);let translator=createTranslator('en'),localeRevision=0;
const t=(key,params)=>translator.t(key,params);let context=null,providerId=null,enquiryId=null,replyDraft='',feedbackKey=null,lastHash=null;
const withdrawn=new Set();const storage=()=>{try{return localStorage;}catch{return null;}};
const actor=()=>({role:'provider',id:providerId});
function option(value,label){const node=document.createElement('option');node.value=value;node.textContent=label;return node;}
for(const provider of demoProviders)$('sampleProvider').append(option(provider.id,provider.name));
function clearDetail(){for(const id of ['detailHeading','detailStatus','detailNote','detailReply'])$(id).textContent='';$('inboxReply').value='';$('inboxActions').replaceChildren();$('inboxBack').removeAttribute('href');}
function render(focus=false,restore=false){
 const route=parseSampleInboxRoute(location.hash),previousEnquiry=enquiryId;
 if(providerId!==route?.providerId || !context){context=createSampleInbox(route?.providerId);providerId=route?.providerId??null;replyDraft='';enquiryId=null;$('inboxStatus').value='all';$('inboxService').replaceChildren();}
 if(context)context.provider.published=!withdrawn.has(providerId);
 enquiryId=route?.enquiryId??null;
 const status=$('inboxStatus').value||'all',service=$('inboxService').value||'all';
 $('inboxStatus').replaceChildren(option('all',t('inbox.all')),...SAMPLE_ENQUIRY_STATES.map(s=>option(s,t('inbox.state.'+s.replaceAll('-','_')))));$('inboxStatus').value=status;
 $('inboxService').replaceChildren(option('all',t('inbox.all')),...(context?.provider.services??[]).map(s=>option(s,s)));$('inboxService').value=service;
 $('sampleProvider').value=providerId??'';$('withdrawProvider').checked=withdrawn.has(providerId);
 $('sampleProviderName').textContent=context?.provider.name??'';
 clearDetail();$('inboxRows').replaceChildren();$('inboxCount').textContent='';
 const list=buildSampleInbox(context,actor(),{status,service});const found=enquiryId?readSampleInboxDetail(context,actor(),enquiryId):null;
 const valid=list.ok&&(!enquiryId||found.ok);
 $('inboxList').hidden=!valid||!!enquiryId;$('inboxDetail').hidden=!valid||!enquiryId;$('inboxUnavailable').hidden=valid;
 let target=$('unavailableHeading');
 if(valid&&!enquiryId){
  replyDraft='';$('inboxEmpty').hidden=list.items.length>0;$('inboxCount').textContent=t('inbox.count',{count:list.items.length});
  for(const row of list.items){const card=document.createElement('article');card.className='card';const link=document.createElement('a');link.href='#inbox/'+providerId+'/enquiry/'+row.id;link.dataset.enquiryId=row.id;link.textContent=row.service+' · '+row.id;const status=document.createElement('p');status.textContent=t('inbox.state.'+row.status.replaceAll('-','_'));card.append(link,status);$('inboxRows').append(card);}
  target=restore?[...document.querySelectorAll('#inboxRows a')].find(a=>a.dataset.enquiryId===previousEnquiry)??$('inboxHeading'):$('inboxHeading');
 }else if(valid){
  const row=found.record;if(previousEnquiry!==enquiryId)replyDraft=row.reply;
  $('detailHeading').textContent=row.service+' · '+row.id;$('detailStatus').textContent=t('inbox.state.'+row.status.replaceAll('-','_'));$('detailNote').textContent=row.note;$('detailReply').textContent=row.reply;$('inboxReply').value=replyDraft;$('inboxReply').setAttribute('aria-invalid',String(feedbackKey==='inbox.replyError'));
  $('inboxBack').href='#inbox/'+providerId;
  for(const [action,states] of Object.entries(SAMPLE_PROVIDER_ACTIONS)){if(action==='reply'||!states.includes(row.status))continue;const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=t('inbox.action.'+action.replaceAll('-','_'));button.addEventListener('click',()=>change(row,action));$('inboxActions').append(button);}
  const canReply=SAMPLE_PROVIDER_ACTIONS.reply.includes(row.status);$('inboxReply').disabled=$('previewReply').disabled=!canReply;target=$('detailHeading');
 }else{replyDraft='';$('sampleProviderName').textContent='';}
 $('inboxFeedback').textContent=feedbackKey?t(feedbackKey):'';
 if(focus){target.focus();window.scrollTo({top:0,behavior:'instant'});}
}
function change(row,action,reply){
 const result=changeSampleEnquiry(context,actor(),{providerId:row.providerId,id:row.id,revision:row.revision,action,...(action==='reply'?{reply}:{})});
 if(!result.ok){feedbackKey='inbox.changed';replyDraft='';clearDetail();$('inboxDetail').hidden=true;$('inboxUnavailable').hidden=false;$('unavailableHeading').focus();$('inboxFeedback').textContent=t(feedbackKey);return;}
 context=result.context;replyDraft=context.records.find(r=>r.id===row.id).reply;feedbackKey='inbox.updated';render(true);
}
function routeChanged(){if(lastHash===location.hash)return;lastHash=location.hash;feedbackKey=null;render(true,true);}
window.addEventListener('hashchange',routeChanged);window.addEventListener('popstate',routeChanged);
$('sampleProvider').addEventListener('change',()=>{location.hash='#inbox/'+$('sampleProvider').value;});
$('withdrawProvider').addEventListener('change',()=>{if($('withdrawProvider').checked)withdrawn.add(providerId);else withdrawn.delete(providerId);context=null;replyDraft='';feedbackKey=null;render(true);});
for(const id of ['inboxStatus','inboxService'])$(id).addEventListener('change',()=>{feedbackKey=null;render();});
$('inboxFilters').addEventListener('submit',e=>e.preventDefault());$('inboxReply').addEventListener('input',()=>{replyDraft=$('inboxReply').value;if(feedbackKey==='inbox.replyError'){feedbackKey=null;$('inboxFeedback').textContent='';$('inboxReply').setAttribute('aria-invalid','false');}});
$('sampleReplyForm').addEventListener('submit',e=>{e.preventDefault();const found=readSampleInboxDetail(context,actor(),enquiryId);if(!found.ok)return;if(!isSampleReply(replyDraft)){feedbackKey='inbox.replyError';$('inboxFeedback').textContent=t(feedbackKey);$('inboxReply').setAttribute('aria-invalid','true');$('inboxReply').focus();return;}change(found.record,'reply',replyDraft);});
$('main').parentElement.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();$('main').focus();});
async function selectLocale(code,persist=false){const version=++localeRevision;let next,failed=false;try{next=await loadTranslator(code);}catch{next=createTranslator('en');failed=true;}if(version!==localeRevision)return;translator=next;applyCatalog(document,translator);$('localeSelect').value=translator.locale;$('localeStatus').textContent=failed?t('languageUnavailable'):t('languageChanged',{language:SUPPORTED_LOCALES.find(l=>l.code===translator.locale).name});if(persist&&!failed)writeLocalePreference(storage(),translator.locale);render();}
$('localeSelect').addEventListener('change',e=>selectLocale(e.target.value,true));
window.addEventListener('pagehide',()=>{context=null;replyDraft='';feedbackKey=null;clearDetail();$('inboxRows').replaceChildren();$('inboxCount').textContent='';});
window.addEventListener('pageshow',e=>{if(e.persisted)render();});
await selectLocale(readLocalePreference(storage(),'gu'));lastHash=location.hash;
