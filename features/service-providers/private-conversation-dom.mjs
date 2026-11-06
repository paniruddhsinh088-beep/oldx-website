import {createServiceConversationIntegration} from './conversation-integration.mjs';
import {createProviderPrivateIntegration} from './private-integration.mjs';
import {parseSampleConversationRoute} from './preview-conversation.mjs';
import {loadTranslator} from '../i18n/i18n.mjs';
import {applyCatalog} from '../i18n/dom.mjs';
const mounts=new WeakMap();
// Existing enquiry journal rendered in the existing conversation page. This is
// not a new Chat sender: provider replies reuse the canonical enquiry command.
// Session/audience cancel presentation; only the injected server authorizes it.
export function mountProviderConversation({root=document,enabled=false,audience='buyer',translate=key=>key,openInbox,messaging={},...options}={}){
 mounts.get(root)?.destroy();
 if(enabled!==true)return Object.freeze({destroy(){}});
 if(!['buyer','provider'].includes(audience))throw new TypeError('Invalid conversation audience');
 const textMessaging=messaging.enabled===true;
 const $=id=>root.getElementById(id),view=root.defaultView,listeners=[];
 let model,selected=null,session=null,localeRevision=0,active=true;
 const listen=(node,type,fn)=>{node?.addEventListener(type,fn,true);listeners.push(()=>node?.removeEventListener(type,fn,true));};
 const route=()=>{const value=parseSampleConversationRoute(view.location.hash);return view.location.hash&&value?.role===audience?value:null;};
 const oldMode=root.documentElement.dataset.providerConversation;
 root.documentElement.dataset.providerConversation='true';
 root.dispatchEvent(new view.CustomEvent('oldx:provider-conversation-mode',{detail:{enabled:true}}));
 const rehearsal=$('sampleRole').closest('section'),wasHidden=rehearsal.hidden;rehearsal.hidden=true;
 $('trustedConversationControls').hidden=false;$('recoverConversation').hidden=true;
 $('messageDraft').maxLength=textMessaging?2000:400;
 function clear(){selected=null;$('messages').replaceChildren();$('conversationService').textContent='';$('messageDraft').value='';$('draftPreview').textContent='';$('draftPreview').hidden=true;}
 function history(value){$('messages').replaceChildren();for(const event of (textMessaging?value.messages.map(m=>({actor:m.role,text:m.text})):value.events)){const li=root.createElement('li'),actor=root.createElement('strong'),text=root.createElement('p');actor.textContent=translate('conversation.'+event.actor);text.textContent=event.text??translate('inbox.state.'+event.status.replaceAll('-','_'));li.append(actor,text);$('messages').append(li);}}
 function render(state){
  const busy=state.status==='loading',ready=!!selected;
  $('conversation').hidden=!ready;$('conversationLoading').hidden=!busy;
  $('conversation').setAttribute('aria-busy',String(busy));
  $('conversationUnavailable').hidden=ready||busy;
  $('conversationFeedback').textContent=translate('market.product.'+state.status);
  $('conversationError').textContent='';
  $('conversationHistoryNext').disabled=!state.selection?.hasMore||busy||state.canRetry||state.readAcknowledgement?.queueFull;
  $('conversationRetryCommand').disabled=!state.canRetry||busy;
  const writable=textMessaging?ready&&selected.thread.canSend:ready&&audience==='provider'&&!['completed','cancelled','declined','disputed'].includes(selected.detail.status);
  $('draftForm').hidden=!writable;$('conversationClosed').hidden=writable;
  $('messageDraft').readOnly=busy||state.mutationBlocked;$('previewDraft').disabled=!writable||busy||state.mutationBlocked;
  $('previewDraft').textContent=translate(textMessaging?'market.provider.sendMessage':'market.provider.reply');
  $('conversationHeading').textContent=translate(textMessaging?'market.provider.messages':'market.provider.privateHistory');if(textMessaging){root.querySelector('label[for=messageDraft]').textContent=translate('market.provider.messageDraft');root.querySelector('#main > p.notice').textContent=translate('market.provider.messageNotice');}
  $('inboxLink').textContent=translate('conversation.back');if(selected)history(selected);
 }
 model=(textMessaging?createServiceConversationIntegration:createProviderPrivateIntegration)({...options,...(textMessaging?messaging:{}),enabled,onAcknowledged:()=>{(textMessaging?messaging.onAcknowledged:options.onAcknowledged)?.();root.dispatchEvent(new view.CustomEvent('oldx:chat-read-state-changed'));},onChange:render,onPrivate:value=>{
  clear();if(!value)return;selected=value;const thread=textMessaging?value.thread:value;
  $('conversationService').textContent=(textMessaging?thread.service:value.detail.service)+' · '+thread.enquiryId;
  history(value);if(textMessaging)queueMicrotask(()=>{if(root.visibilityState!=='hidden'&&$('messages').getClientRects().length)model.acknowledgeVisible();});
  $('conversationEmpty').hidden=(textMessaging?value.messages:value.events).length!==0;
 }});
 async function restore(){
  clear();const current=route();model.changeScope();
  if(!active||!session||!current){render(model.snapshot());return;}
  model.select(current.providerId,audience);
  $('inboxLink').href='./service-inbox-preview.html#inbox/'+current.providerId+'/enquiry/'+current.enquiryId;
  await model.detail(current.enquiryId);if(active&&session&&(textMessaging?selected?.thread:selected)?.enquiryId===current.enquiryId&&(textMessaging?selected?.thread:selected)?.providerId===current.providerId&&route()?.enquiryId===current.enquiryId)$('conversationHeading').focus();
 }
 async function afterMutation(work){const current=route();await work();if(model.snapshot().status==='saved'&&current&&route()?.enquiryId===current.enquiryId&&route()?.providerId===current.providerId)await model.detail(current.enquiryId);}
 listen($('draftForm'),'submit',event=>{event.preventDefault();event.stopImmediatePropagation();if(!session||!selected||!route()||(textMessaging?selected.thread:selected).enquiryId!==route().enquiryId)return;afterMutation(()=>textMessaging?model.send($('messageDraft').value):model.change('reply',$('messageDraft').value));});
 listen($('cancelDraft'),'click',event=>{event.stopImmediatePropagation();if(!model.snapshot().canRetry){$('messageDraft').value='';$('messageDraft').focus();}});
 listen($('conversationRetryCommand'),'click',()=>afterMutation(()=>model.retry()));
 for(const id of ['retryConversation','conversationReload'])listen($(id),'click',()=>restore());
 listen($('conversationHistoryNext'),'click',()=>model.nextHistory());
 listen($('inboxLink'),'click',event=>{if(typeof openInbox!=='function')return;event.preventDefault();event.stopImmediatePropagation();const current=route();if(current){model.changeScope();openInbox({providerId:current.providerId,enquiryId:current.enquiryId});}});
 listen($('localeSelect'),'change',async event=>{event.stopImmediatePropagation();const version=++localeRevision,catalog=await loadTranslator(event.target.value);if(!active||version!==localeRevision)return;translate=key=>catalog.t(key);applyCatalog(root,catalog);render(model.snapshot());});
 for(const type of ['popstate','hashchange'])listen(view,type,event=>{event.stopImmediatePropagation();restore();});
 listen(root,'visibilitychange',()=>{if(root.visibilityState!=='hidden'&&$('messages').getClientRects().length)model.acknowledgeVisible?.();});
 listen(view,'offline',()=>model.setOnline(false));listen(view,'online',()=>model.setOnline(true));
 listen(view,'pagehide',()=>{active=false;localeRevision++;model.clear();clear();session=null;});
 const api=Object.freeze({model,restoreRoute:restore,changeScope(){model.changeScope();clear();},
  async setSession(value){active=true;session=value?{uid:value.uid,sessionId:value.sessionId}:null;model.setSession(value);clear();if(session)await restore();},
  open({providerId,enquiryId}={}){if(![providerId,enquiryId].every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id)))return false;view.history.pushState(null,'','#conversation/'+audience+'/'+providerId+'/'+enquiryId);return restore();},
  destroy(){active=false;localeRevision++;listeners.forEach(fn=>fn());model.clear();clear();rehearsal.hidden=wasHidden;$('trustedConversationControls').hidden=true;$('recoverConversation').hidden=false;$('messageDraft').maxLength=2000;if(oldMode===undefined)delete root.documentElement.dataset.providerConversation;else root.documentElement.dataset.providerConversation=oldMode;root.dispatchEvent(new view.CustomEvent('oldx:provider-conversation-mode',{detail:{enabled:false}}));mounts.delete(root);}
 });mounts.set(root,api);return api;
}
