import {createProviderJourneyIntegration} from './enquiry-integration.mjs';
const bindings=new WeakMap();
// Existing-page binding, not a route or endpoint. Enabled only by explicit injected
// host/test ports; no global configuration, fetch or Firebase initialization.
export function mountProviderUiIntegration({root=document,enabled=false,readProfile,clearPrivateForm=()=>{},restorePrivateForm=()=>{},translate=key=>key,onPublicState=()=>{},...options}={}){
 bindings.get(root)?.destroy();const $=id=>root.getElementById(id),listeners=[];let lastPublic=null,model,sessionKey=null;
 const listen=(node,type,callback)=>{node.addEventListener(type,callback);listeners.push(()=>node.removeEventListener(type,callback));};
 function render(state){
  $('providerIntegrationStatus').textContent=translate('integration.'+state.command.status);
  $('providerOwnerStatus').textContent=translate('owner.'+state.owner.status);$('loadProviderOwner').disabled=!enabled||state.command.status==='loading'||state.owner.status==='loading';
  const busy=state.command.status==='loading'||state.owner.status==='loading',blocked=busy||state.command.canRetry||!enabled;
  for(const id of ['saveProviderDraft','publishProvider','withdrawProvider'])$(id).disabled=blocked;
  $('retryProviderCommand').disabled=!enabled||!state.command.canRetry||busy;
  $('providerIntegrationPanel').setAttribute('aria-busy',String(busy));
  if(enabled&&lastPublic!==state.public){lastPublic=state.public;onPublicState(state.public);}
 }
 const journey=createProviderJourneyIntegration({...options,enabled,onOwnerDraft:restorePrivateForm,onChange:render});model=journey.owner;
 listen($('loadProviderOwner'),'click',()=>model.bootstrap({restoreDraft:true}));
 listen($('saveProviderDraft'),'click',()=>model.saveDraft(readProfile?.()));listen($('publishProvider'),'click',()=>model.publish());listen($('withdrawProvider'),'click',()=>model.withdraw());listen($('retryProviderCommand'),'click',()=>model.retry());
 const window=root.defaultView;
 for(const event of ['hashchange','popstate'])listen(window,event,()=>journey.changeScope());
 for(const id of ['q','area','sort','availableOnly','categories'])listen($(id),'input',()=>journey.changeScope());
 listen($('categories'),'click',()=>journey.changeScope());listen($('resetSearch'),'click',()=>journey.changeScope());
 listen(window,'offline',()=>journey.setOnline(false));listen(window,'online',()=>journey.setOnline(true));
 listen(window,'pagehide',()=>{journey.clear();if(enabled)clearPrivateForm();});
 const api=Object.freeze({model,buyer:journey.buyer,setSession(value){const key=value?value.uid+'/'+value.sessionId:null;if(enabled&&key!==sessionKey)clearPrivateForm();sessionKey=key;journey.setSession(value);},render(){lastPublic=null;render(model.snapshot());},destroy(){listeners.forEach(remove=>remove());journey.clear();bindings.delete(root);}});bindings.set(root,api);return api;
}
