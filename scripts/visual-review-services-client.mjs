import {loadTranslator} from './features/i18n/i18n.mjs';
import {applyCatalog} from './features/i18n/dom.mjs';
import {demoProviders} from './features/service-providers/preview-fixtures.mjs';
import {buildPublicProviderProfile} from './features/service-providers/provider-public-profile.mjs';

const $=id=>document.getElementById(id);
const allServices='બધી સેવાઓ';
const websiteMode=false,providerIntegrationEnabled=true;
const demoIcons=new Map(demoProviders.map(provider=>[provider.id,provider.icon]));
const fixtures=demoProviders.map((provider,index)=>buildPublicProviderProfile({
 id:provider.id,displayName:provider.name,city:provider.city,serviceArea:provider.area,
 services:provider.services,available:provider.available!==false,experienceYears:provider.experience,
 description:index===0?'નમૂનાનુંવર્ણનनमूनेकाविवरणSyntheticDescription'.repeat(15):provider.about
})).map(result=>{
 if(!result.ok)throw new Error('Invalid synthetic provider');
 return result.profile;
});
let translator=await loadTranslator('gu');
const t=(key,params)=>translator.t(key,params);
let publicProfiles=fixtures,publicReadStatus='ready',activeCategory=allServices,returnToResult=null;
let activeProvider=null,localeVersion=0;

function focus(target){
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'center',behavior:'instant'});
}

function navigate(hash){
 if(location.hash!==hash)history.pushState(null,'',hash);
 showRoute();
}

function showRoute(){
 const id=/^#provider\/([A-Za-z0-9_-]+)$/.exec(location.hash)?.[1];
 activeProvider=fixtures.find(provider=>provider.id===id)??null;
 const showProfile=Boolean(activeProvider);
 for(const [view,visible] of [['profileView',showProfile],['browseView',!showProfile]]){
  $(view).hidden=!visible;
  $(view).classList.toggle('active',visible);
 }
 if(showProfile){renderPublicProfile(activeProvider);focus($('pName'));}
 else focus(returnToResult?.isConnected?returnToResult:$('resultsHeading'));
}

function setScenario(scenario){
 publicProfiles=scenario==='ready'?fixtures:[];
 publicReadStatus=scenario==='empty'?'ready':scenario==='error'?'error':scenario;
 render();
 $('reviewReadStatus').textContent=publicReadStatus==='ready'?'':t(publicReadStatus==='error'?'integration.read_unavailable':'integration.read_loading');
 $('reviewRetry').hidden=publicReadStatus!=='error';
}

function selectCategory(value){
 activeCategory=value;
 for(const button of $('categories').querySelectorAll('[data-cat]')){
  const selected=button.dataset.cat===value;
  button.classList.toggle('active',selected);
  button.setAttribute('aria-pressed',String(selected));
 }
 render();
}

$('categories').addEventListener('click',event=>{
 const button=event.target.closest('[data-cat]');
 if(button)selectCategory(button.dataset.cat);
});
for(const id of ['q','area','sort','availableOnly'])$(id).addEventListener('input',render);
$('providerSearchForm').addEventListener('submit',event=>{event.preventDefault();render();});
$('resetSearch').addEventListener('click',()=>{
 $('providerSearchForm').reset();$('availableOnly').checked=false;selectCategory(allServices);focus($('q'));
});
$('backBtn').addEventListener('click',()=>navigate('#services'));
window.addEventListener('popstate',showRoute);
window.addEventListener('hashchange',showRoute);
$('reviewScenario').addEventListener('change',event=>setScenario(event.target.value));
$('reviewRetry').addEventListener('click',()=>{$('reviewScenario').value='ready';setScenario('ready');focus($('resultsHeading'));});
$('reviewLocale').addEventListener('change',async event=>{
 const version=++localeVersion,selected=event.target.value;
 const next=await loadTranslator(selected);
 if(version!==localeVersion)return;
 const previous=returnToResult?.dataset.providerId;
 translator=next;
 applyCatalog(document,translator);
 setScenario($('reviewScenario').value);
 returnToResult=[...$('results').querySelectorAll('[data-provider-id]')].find(button=>button.dataset.providerId===previous);
 if(activeProvider)renderPublicProfile(activeProvider);
});
applyCatalog(document,translator);
setScenario('ready');
if(location.hash)showRoute();
