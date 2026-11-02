import {loadTranslator,createTranslator} from './i18n.mjs';
import {applyCatalog} from './dom.mjs';
import {readLocalePreference,writeLocalePreference} from './preference.mjs';
const bindings=new WeakMap();
// First-party essential controls only; never translates seller content, changes
// auth state or stores private data. No backend/config/network dependencies.
export function mountMarketplaceLocale({root=document,storage,load=loadTranslator}={}){
 bindings.get(root)?.destroy();
 const select=root.getElementById('marketplaceLocale'),status=root.getElementById('marketplaceLocaleStatus');if(!select||!status)return null;
 let version=0,destroyed=false;
 async function change(locale,persist=false){const current=++version;let translator;select.setAttribute('aria-busy','true');try{translator=await load(locale);}catch{translator=createTranslator('en');}if(destroyed||current!==version)return;applyCatalog(root,translator);select.value=translator.locale;select.removeAttribute('aria-busy');status.textContent=translator.t(translator.locale===locale?'languageChanged':'languageUnavailable',{language:translator.locale});if(persist)writeLocalePreference(storage,translator.locale);}
 const listener=()=>change(select.value,true);select.addEventListener('change',listener);const ready=change(readLocalePreference(storage,'en'));
 const binding=Object.freeze({ready,change,destroy(){destroyed=true;version++;select.removeEventListener('change',listener);select.removeAttribute('aria-busy');if(bindings.get(root)===binding)bindings.delete(root);}});bindings.set(root,binding);return binding;
}
if(typeof document!=='undefined'&&document.getElementById('marketplaceLocale')){let storage;try{storage=globalThis.localStorage;}catch{}mountMarketplaceLocale({storage});}
