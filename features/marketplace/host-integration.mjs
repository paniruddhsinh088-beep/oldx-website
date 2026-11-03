import {mountProductIntegration} from './product-integration-dom.mjs';
import {mountStoreIntegration} from './store-integration-dom.mjs';
import {parseProductRoute} from './product-route.mjs';
import {parseServicePreviewRoute} from '../service-providers/preview-route.mjs';
import {parseSampleInboxRoute} from '../service-providers/preview-inbox-route.mjs';
import {parseSampleConversationRoute} from '../service-providers/preview-conversation.mjs';
import {createMarketplaceNavigation} from './navigation-integration.mjs';
import {createMarketplaceSessionIntegration,providerSessionBinding} from './session-integration.mjs';
// Explicit host for existing main-page widgets. The existing feature parsers and
// controllers own their URLs; this host only selects a binding. No Auth listener,
// endpoint, Firebase config, browser redirect or transport is constructed here.
export function mountMarketplaceHost({root=document,enabled=false,product={},store={},providers,onView=()=>{}}={}){
 if(enabled!==true)return Object.freeze({setSession:async()=>false,go:async()=>false,restoreRoute:async()=>false,destroy(){}});
 const view=root.defaultView,listeners=[];let navigation,products,stores,active=true;
 const listen=(node,type,fn)=>{node?.addEventListener(type,fn,true);listeners.push(()=>node?.removeEventListener(type,fn,true));};
 const cancelProviders=()=>providers?.navigation?.changeScope?.();
 products=mountProductIntegration({...product,root,enabled,managedRoutes:true,beforeNavigate:()=>{stores?.model.changeScope();cancelProviders();},openStore:id=>navigation.go('store',id)});
 stores=mountStoreIntegration({...store,root,enabled,managedRoutes:true,beforeNavigate:()=>{products.model.changeScope();cancelProviders();},onProduct:id=>navigation.go('product',id)});
 function directory(){view.history.pushState(view.history.state,'',view.location.pathname+view.location.search+'#stores');products.show('homeView');return stores.discover({category:root.getElementById('trustedStoreFilter')?.value??''});}
 navigation=createMarketplaceNavigation({enabled,product:{changeScope:()=>products.model.changeScope(),discover:()=>products.navigate('home'),openProduct:id=>products.navigate('product',id)},store:{changeScope:()=>stores.model.changeScope(),open:id=>stores.open(id),discover:directory},providers:providers?.navigation,onView});
 async function restoreRoute(){
  if(!active)return false;const hash=view.location.hash;
  navigation.clear();
  if(parseProductRoute(hash))return products.restoreRoute();
  if(hash==='#store'||/^#store-[A-Za-z0-9_-]{1,100}$/.test(hash))return stores.restoreRoute();
  if(hash==='#stores'){products.show('homeView');return stores.discover({category:root.getElementById('trustedStoreFilter')?.value??''});}
  const publicRoute=parseServicePreviewRoute(hash);
  if(publicRoute?.view==='browse')return navigation.go('providers');
  if(publicRoute?.view==='profile')return navigation.go('provider',publicRoute.providerId);
  const inbox=hash.startsWith('#inbox/')?parseSampleInboxRoute(hash):null;
  if(inbox)return navigation.go('inbox',inbox.enquiryId?{providerId:inbox.providerId,enquiryId:inbox.enquiryId}:inbox.providerId);
  const conversation=hash.startsWith('#conversation/')?parseSampleConversationRoute(hash):null;
  if(conversation)return navigation.go('conversation',{providerId:conversation.providerId,enquiryId:conversation.enquiryId});
  products.show('homeView');return false;
 }
 for(const type of ['hashchange','popstate'])listen(view,type,event=>{event.stopImmediatePropagation();restoreRoute();});
 listen(root.getElementById('trustedStoreBrowse'),'click',event=>{event.preventDefault();event.stopImmediatePropagation();navigation.go('stores');});
 if(providers?.navigation)listen(root.querySelector('#homeServicesPreviewSection a[href="./service-preview.html"]'),'click',event=>{event.preventDefault();event.stopImmediatePropagation();navigation.go('providers');});
 const sessions=createMarketplaceSessionIntegration({enabled,bindings:[products,stores,...(providers?.journey?[providerSessionBinding(providers.journey)]:[])]});
 return Object.freeze({product:products,store:stores,restoreRoute,async setSession(value){const result=await sessions.setSession(value);if(result&&active)await restoreRoute();return result;},go:(page,id)=>navigation.go(page,id),async destroy(){active=false;listeners.forEach(fn=>fn());navigation.clear();await sessions.logout();products.destroy();stores.destroy();}});
}
