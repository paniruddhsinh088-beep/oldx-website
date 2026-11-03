import {mountProductIntegration} from './product-integration-dom.mjs';
import {mountStoreIntegration} from './store-integration-dom.mjs';
import {createMarketplaceNavigation} from './navigation-integration.mjs';
import {createMarketplaceSessionIntegration,providerSessionBinding} from './session-integration.mjs';
// One explicitly injected host for existing main-page widgets. No auto mount,
// Auth listener, endpoint, Firebase config or transport is constructed here.
export function mountMarketplaceHost({root=document,enabled=false,product={},store={},providers,onView=()=>{}}={}){
 if(enabled!==true)return Object.freeze({setSession:async()=>false,go:async()=>false,destroy(){}});let navigation;
 const products=mountProductIntegration({...product,root,enabled,openStore:id=>navigation.go('store',id)}),stores=mountStoreIntegration({...store,root,enabled,onProduct:id=>navigation.go('product',id)});
 navigation=createMarketplaceNavigation({enabled,product:{changeScope:()=>products.model.changeScope(),discover:()=>{products.show('homeView');return products.model.discover();},openProduct:id=>products.navigate('product',id)},store:{changeScope:()=>stores.model.changeScope(),open:id=>stores.open(id),discover:()=>{products.show('homeView');return stores.discover();}},providers:providers?.navigation,onView});
 const sessions=createMarketplaceSessionIntegration({enabled,bindings:[products,stores,...(providers?.journey?[providerSessionBinding(providers.journey)]:[])]});
 return Object.freeze({product:products,store:stores,setSession:value=>sessions.setSession(value),go:(page,id)=>navigation.go(page,id),async destroy(){navigation.clear();await sessions.logout();products.destroy();stores.destroy();}});
}
