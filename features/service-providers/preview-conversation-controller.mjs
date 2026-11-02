import {parseSampleConversationRoute} from './preview-conversation.mjs';
import {createConversationRead,createMockConversationRead} from './preview-conversation-read.mjs';
import {normalizeMessageDraft} from '../chat/message-text.mjs';
import {createTranslator,loadTranslator,SUPPORTED_LOCALES} from '../i18n/i18n.mjs';
import {applyCatalog} from '../i18n/dom.mjs';
import {readLocalePreference,writeLocalePreference} from '../i18n/preference.mjs';
const $=id=>document.getElementById(id);let translator=createTranslator('en'),localeVersion=0,scopeKey=null,route=null,feedback=null,state={status:'idle'},pageActive=true,refreshRevision=0;
const t=key=>translator.t(key),storage=()=>{try{return localStorage;}catch{return null;}};
function clearDraft(){ $('messageDraft').value='';$('draftPreview').textContent='';$('draftPreview').hidden=true;feedback=null;$('messageDraft').setAttribute('aria-invalid','false');$('conversationFeedback').textContent='';}
function clearPrivate(){clearDraft();$('messages').replaceChildren();$('conversationService').textContent='';}
const reader=createConversationRead({read:createMockConversationRead({mode:()=>$('sampleReadMode').value,unavailable:()=>$('sampleBlocked').checked||$('sampleWithdrawn').checked}),timeoutMs:700,onChange:next=>{state=next;if(next.status!=='ready')clearPrivate();render();}});
function render(focus=false){
 const view=state.snapshot,ready=state.status==='ready';
 $('conversation').hidden=!ready;$('conversationUnavailable').hidden=!['unavailable','error'].includes(state.status);
 $('conversationLoading').hidden=state.status!=='loading';$('conversation').setAttribute('aria-busy',String(state.status==='loading'));
 $('conversationError').textContent=state.status==='error'?t(state.code==='READ_TIMEOUT'?'conversation.timeout':'conversation.readError'):'';
 $('messages').replaceChildren();
 if(ready){
  $('sampleRole').value=route.role;$('conversationService').textContent=view.enquiry.service+' · '+view.enquiry.id;
  for(const item of view.items){const li=document.createElement('li'),label=document.createElement('strong'),text=document.createElement('p');label.textContent=t('conversation.'+item.role);text.textContent=item.text;li.append(label,text);$('messages').append(li);}
  $('conversationEmpty').hidden=view.items.length!==0;
  $('messageDraft').disabled=$('previewDraft').disabled=!view.canDraft;$('conversationClosed').hidden=view.canDraft;
  $('inboxLink').href=route.role==='provider'?'./service-inbox-preview.html#inbox/'+route.providerId+'/enquiry/'+route.enquiryId:'./service-buyer-preview.html#buyer/sample-buyer-1/provider/'+route.providerId+'/enquiry/'+route.enquiryId;
 }
 $('conversationFeedback').textContent=feedback?t(feedback):'';
 if(focus)$(ready?'conversationHeading':'conversationUnavailableHeading').focus();
}
function refresh(focus=false){
 const version=++refreshRevision;clearPrivate();route=parseSampleConversationRoute(location.hash);scopeKey=route?JSON.stringify(route):'invalid';
 if(!pageActive||!route||$('sampleBlocked').checked||$('sampleWithdrawn').checked){reader.revoke();if(focus)render(true);return;}
 // Loading is announced without stealing focus. Completion focuses the heading
 // only if focus was inside the now-hidden private view or route navigation.
 reader.load(route).then(()=>{if(version===refreshRevision&&focus&&pageActive&&state.status!=='loading')render(true);});
}
window.addEventListener('hashchange',()=>refresh(true));window.addEventListener('popstate',()=>refresh(true));
$('sampleRole').addEventListener('change',()=>{clearPrivate();location.hash='#conversation/'+$('sampleRole').value+'/'+(route?.providerId??'p1')+'/'+(route?.enquiryId??'p1-sample-3');});
for(const id of ['sampleBlocked','sampleWithdrawn','sampleReadMode'])$(id).addEventListener('change',()=>refresh(false));
$('retryConversation').addEventListener('click',()=>refresh(true));
$('draftForm').addEventListener('submit',event=>{event.preventDefault();
 // Re-read the URL and publication/block facts at action time, not captured view.
 if(JSON.stringify(parseSampleConversationRoute(location.hash))!==scopeKey||state.status!=='ready'||$('sampleBlocked').checked||$('sampleWithdrawn').checked){refresh(true);return;}
 const text=normalizeMessageDraft($('messageDraft').value);const checked={ok:state.snapshot.canDraft&&text!==null,text};
 if(!checked.ok){clearDraft();feedback='conversation.invalid';$('messageDraft').setAttribute('aria-invalid','true');$('messageDraft').focus();}
 else{$('draftPreview').textContent=checked.text;$('draftPreview').hidden=false;feedback='conversation.previewed';}
 $('conversationFeedback').textContent=t(feedback);
});
$('messageDraft').addEventListener('input',()=>{$('draftPreview').textContent='';$('draftPreview').hidden=true;feedback=null;$('conversationFeedback').textContent='';$('messageDraft').setAttribute('aria-invalid','false');});
$('cancelDraft').addEventListener('click',()=>{clearDraft();feedback='conversation.cancelled';$('conversationFeedback').textContent=t(feedback);$('messageDraft').focus();});
$('recoverConversation').addEventListener('click',()=>{clearPrivate();$('sampleBlocked').checked=$('sampleWithdrawn').checked=false;$('sampleReadMode').value='normal';location.hash='#conversation/buyer/p1/p1-sample-3';refresh(true);});
async function selectLocale(code,persist=false){const version=++localeVersion;let next;try{next=await loadTranslator(code);}catch{next=createTranslator('en');}if(version!==localeVersion)return;translator=next;applyCatalog(document,translator);$('localeSelect').value=translator.locale;$('localeStatus').textContent=SUPPORTED_LOCALES.find(l=>l.code===translator.locale).name;if(persist)writeLocalePreference(storage(),translator.locale);render();}
$('localeSelect').addEventListener('change',e=>selectLocale(e.target.value,true));
window.addEventListener('pagehide',()=>{localeVersion++;refreshRevision++;pageActive=false;reader.clear();clearPrivate();route=null;scopeKey=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){pageActive=true;refresh();}});
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();$('main').focus();});
await selectLocale(readLocalePreference(storage(),'gu'));refresh();
