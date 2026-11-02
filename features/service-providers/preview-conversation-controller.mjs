import {createSampleBuyerInbox} from './preview-inbox-fixtures.mjs';
import {readSampleConversation,inspectSampleConversationDraft,createSampleConversationMessages,parseSampleConversationRoute} from './preview-conversation.mjs';
import {createTranslator,loadTranslator,SUPPORTED_LOCALES} from '../i18n/i18n.mjs';
import {applyCatalog} from '../i18n/dom.mjs';
import {readLocalePreference,writeLocalePreference} from '../i18n/preference.mjs';
const $=id=>document.getElementById(id);let translator=createTranslator('en'),localeVersion=0,scopeKey=null,context=null,route=null,scope=null,messages=[],feedback=null;
const t=key=>translator.t(key),storage=()=>{try{return localStorage;}catch{return null;}};
const actor=()=>({role:route?.role,id:route?.role==='provider'?route.providerId:'sample-buyer-1'});
const blocks=()=>({buyerBlocked:$('sampleBlocked').checked,providerBlocked:false});
function clearDraft(){ $('messageDraft').value='';$('draftPreview').textContent='';$('draftPreview').hidden=true;feedback=null;$('messageDraft').setAttribute('aria-invalid','false');$('conversationFeedback').textContent='';}
function clearPrivate(){clearDraft();$('messages').replaceChildren();$('conversationService').textContent='';}
function render(focus=false){
 const next=parseSampleConversationRoute(location.hash),key=next?JSON.stringify(next):'invalid';
 if(key!==scopeKey){clearPrivate();scopeKey=key;context=createSampleBuyerInbox(next?.providerId);route=next;const row=context?.records.find(r=>r.id===next?.enquiryId);scope=row?{providerId:row.providerId,enquiryId:row.id,revision:row.revision}:null;messages=createSampleConversationMessages(context,next?.enquiryId);}
 if(context)context.provider.published=!$('sampleWithdrawn').checked;
 const view=readSampleConversation(context,actor(),scope,messages,blocks());
 $('conversation').hidden=!view.ok;$('conversationUnavailable').hidden=view.ok;$('messages').replaceChildren();
 if(!view.ok){clearPrivate();}else{
  $('sampleRole').value=route.role;$('conversationService').textContent=view.enquiry.service+' · '+view.enquiry.id;
  for(const item of view.items){const li=document.createElement('li'),label=document.createElement('strong'),text=document.createElement('p');label.textContent=t('conversation.'+item.role);text.textContent=item.text;li.append(label,text);$('messages').append(li);}
  $('messageDraft').disabled=$('previewDraft').disabled=!view.canDraft;$('conversationClosed').hidden=view.canDraft;
  $('inboxLink').href=route.role==='provider'?'./service-inbox-preview.html#inbox/'+route.providerId+'/enquiry/'+route.enquiryId:'./service-buyer-preview.html#buyer/sample-buyer-1/provider/'+route.providerId+'/enquiry/'+route.enquiryId;
 }
 $('conversationFeedback').textContent=feedback?t(feedback):'';
 if(focus)$(view.ok?'conversationHeading':'conversationUnavailableHeading').focus();
}
window.addEventListener('hashchange',()=>render(true));window.addEventListener('popstate',()=>render(true));
$('sampleRole').addEventListener('change',()=>{clearPrivate();location.hash='#conversation/'+$('sampleRole').value+'/'+(route?.providerId??'p1')+'/'+(route?.enquiryId??'p1-sample-3');});
for(const id of ['sampleBlocked','sampleWithdrawn'])$(id).addEventListener('change',()=>{clearPrivate();render(true);});
$('draftForm').addEventListener('submit',event=>{event.preventDefault();
 // Re-read the URL and publication/block facts at action time, not captured view.
 if(JSON.stringify(parseSampleConversationRoute(location.hash))!==scopeKey){render(true);return;}
 const checked=inspectSampleConversationDraft(context,actor(),scope,messages,blocks(),$('messageDraft').value);
 if(!checked.ok){clearDraft();feedback='conversation.invalid';$('messageDraft').setAttribute('aria-invalid','true');$('messageDraft').focus();}
 else{$('draftPreview').textContent=checked.text;$('draftPreview').hidden=false;feedback='conversation.previewed';}
 $('conversationFeedback').textContent=t(feedback);
});
$('messageDraft').addEventListener('input',()=>{$('draftPreview').textContent='';$('draftPreview').hidden=true;feedback=null;$('conversationFeedback').textContent='';$('messageDraft').setAttribute('aria-invalid','false');});
$('cancelDraft').addEventListener('click',()=>{clearDraft();feedback='conversation.cancelled';$('conversationFeedback').textContent=t(feedback);$('messageDraft').focus();});
$('recoverConversation').addEventListener('click',()=>{clearPrivate();$('sampleBlocked').checked=$('sampleWithdrawn').checked=false;location.hash='#conversation/buyer/p1/p1-sample-3';render(true);});
async function selectLocale(code,persist=false){const version=++localeVersion;let next;try{next=await loadTranslator(code);}catch{next=createTranslator('en');}if(version!==localeVersion)return;translator=next;applyCatalog(document,translator);$('localeSelect').value=translator.locale;$('localeStatus').textContent=SUPPORTED_LOCALES.find(l=>l.code===translator.locale).name;if(persist)writeLocalePreference(storage(),translator.locale);render();}
$('localeSelect').addEventListener('change',e=>selectLocale(e.target.value,true));
window.addEventListener('pagehide',()=>{localeVersion++;clearPrivate();context=null;messages=[];scope=null;scopeKey=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();$('main').focus();});
await selectLocale(readLocalePreference(storage(),'gu'));
