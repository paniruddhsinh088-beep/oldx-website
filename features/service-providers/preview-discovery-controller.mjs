import {createPublicProviderDiscoveryRead,createPublicProviderDetailRead} from './provider-discovery.mjs';
import {sampleDiscoveryCatalog,createSampleDiscoveryRepository} from './preview-discovery-repository.mjs';
import {createTranslator,loadTranslator,SUPPORTED_LOCALES} from '../i18n/i18n.mjs';
import {applyCatalog} from '../i18n/dom.mjs';
import {readLocalePreference,writeLocalePreference} from '../i18n/preference.mjs';
const $=id=>document.getElementById(id);let translator=createTranslator('en'),localeRevision=0,state={status:'idle'},cursor=null,active=true,revision=0,detailState={status:'idle'},detailRequest=null;
const t=(key,params)=>translator.t(key,params),storage=()=>{try{return localStorage;}catch{return null;}};
for(const [id,values] of [['discoveryCategory',sampleDiscoveryCatalog.services],['discoveryLocality',sampleDiscoveryCatalog.localities.map(l=>l.serviceArea)]])for(const value of values){const option=document.createElement('option');option.value=option.textContent=value;$(id).append(option);}
const repository=createSampleDiscoveryRepository({mode:()=>$('discoveryMode').value,withdrawn:()=>$('withdrawDiscovery').checked});
const reader=createPublicProviderDiscoveryRead({repository,timeoutMs:700,onChange:next=>{state=next;render();}});
const detailReader=createPublicProviderDetailRead({repository,timeoutMs:700,onChange:next=>{detailState=next;render();}});
function render(){
 const detail=detailRequest!==null,detailReady=detailState.status==='ready';
 $('discoveryResults').hidden=detail;$('providerDetailView').hidden=!detail;
 $('detailLoading').hidden=detailState.status!=='loading';$('providerDetailContent').hidden=!detailReady;
 $('providerDetailError').hidden=!['unavailable','error'].includes(detailState.status);
 $('providerDetailErrorText').textContent=t(detailState.code==='READ_TIMEOUT'?'discovery.timeout':'discovery.error');
 for(const id of ['publicProviderName','publicProviderArea','publicProviderServices','publicProviderDescription'])$(id).textContent='';
 if(detail&&detailReady){const p=detailState.snapshot.profile;$('publicProviderName').textContent=p.displayName;$('publicProviderArea').textContent=p.serviceArea;$('publicProviderServices').textContent=p.services.join(' · ');$('publicProviderDescription').textContent=p.description;}

 $('discoveryRows').replaceChildren();const ready=state.status==='ready';
 $('discoveryRows').setAttribute('aria-busy',String(state.status==='loading'));
 $('discoveryLoading').hidden=state.status!=='loading';$('discoveryError').hidden=!['unavailable','error'].includes(state.status);
 $('discoveryErrorText').textContent=t(state.code==='READ_TIMEOUT'?'discovery.timeout':'discovery.error');
 $('discoveryEmpty').hidden=!ready||state.snapshot.items.length!==0;
 $('discoveryCount').textContent=ready?t('resultCount',{count:state.snapshot.items.length}):'';
 $('nextDiscovery').disabled=!ready||!state.snapshot.nextCursor;$('firstDiscovery').disabled=!ready||cursor===null;
 if(!ready)return;
 for(const profile of state.snapshot.items){const article=document.createElement('article');article.className='card';const heading=document.createElement('h2'),link=document.createElement('a'),area=document.createElement('p'),services=document.createElement('p');link.textContent=profile.displayName;link.href='#provider/'+profile.id+'/'+state.snapshot.publicationEpoch;link.dataset.providerId=profile.id;heading.append(link);area.textContent=profile.serviceArea;services.textContent=profile.services.join(' · ');article.append(heading,area,services);$('discoveryRows').append(article);}
}
function refresh(reset=true,focus=false){if(detailRequest!==null){loadDetail(focus);return;}if(reset)cursor=null;const version=++revision;if(!active){reader.clear();return;}reader.load({category:$('discoveryCategory').value,locality:$('discoveryLocality').value,limit:2,cursor}).then(()=>{if(version===revision&&focus&&active)$('discoveryResultsHeading').focus();});}
for(const id of ['discoveryCategory','discoveryLocality'])$(id).addEventListener('change',()=>{if(detailRequest!==null)location.hash='';else refresh();});
for(const id of ['discoveryMode','withdrawDiscovery'])$(id).addEventListener('change',()=>refresh());
$('discoveryFilters').addEventListener('submit',event=>{event.preventDefault();refresh();});
$('nextDiscovery').addEventListener('click',()=>{if(state.status==='ready'&&state.snapshot.nextCursor){cursor=state.snapshot.nextCursor;refresh(false,true);}});
$('firstDiscovery').addEventListener('click',()=>refresh(true,true));$('retryDiscovery').addEventListener('click',()=>refresh(true,true));
async function selectLocale(code,persist=false){const version=++localeRevision;let next;try{next=await loadTranslator(code);}catch{next=createTranslator('en');}if(version!==localeRevision)return;translator=next;applyCatalog(document,translator);$('localeSelect').value=translator.locale;$('localeStatus').textContent=SUPPORTED_LOCALES.find(l=>l.code===translator.locale).name;if(persist)writeLocalePreference(storage(),translator.locale);render();}
$('localeSelect').addEventListener('change',e=>selectLocale(e.target.value,true));
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();$('main').focus();});
window.addEventListener('pagehide',()=>{active=false;revision++;localeRevision++;cursor=null;reader.clear();detailReader.clear();});
window.addEventListener('pageshow',e=>{if(e.persisted){active=true;routeChanged();}});
function loadDetail(focus=false){const version=++revision;detailReader.clear();reader.clear();if(!active){detailReader.clear();return;}if(!detailRequest.providerId){detailReader.revoke();if(focus&&active)$('providerDetailHeading').focus();return;}
 detailReader.load(detailRequest).then(()=>{if(version===revision&&focus&&active)$('providerDetailHeading').focus();});}
function routeChanged(){
 if(location.hash===''){detailRequest=null;detailReader.clear();refresh();return;}
 const match=/^#provider\/([A-Za-z0-9_-]{1,100})(?:\/(0|[1-9][0-9]{0,15}))?$/.exec(location.hash);
 detailRequest=match?{providerId:match[1],expectedGeneration:match[2]===undefined?null:Number(match[2])}:{providerId:null};loadDetail(true);
}
window.addEventListener('hashchange',routeChanged);
$('retryProviderDetail').addEventListener('click',()=>loadDetail(true));
await selectLocale(readLocalePreference(storage(),'gu'));routeChanged();
