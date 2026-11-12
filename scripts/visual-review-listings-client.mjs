import {loadTranslator} from './features/i18n/i18n.mjs';
import {applyCatalog} from './features/i18n/dom.mjs';

const byId=id=>document.getElementById(id);
const image=new URL('./features/mobile-demo/sample-art.svg',location.href).href;
const broken=new URL('./visual-review.css',location.href).href;
const longText='વેચનારનુંમૂળલખાણविक्रेताकामूलपाठSellerOriginalText'.repeat(5);
const products=[
 {docId:'review-chair',title:'નમૂનાની ખુરશી · नमूना कुर्सी',desc:longText,location:'અમદાવાદ · अहमदाबाद',
  category:'furniture',finalPriceStr:'₹1,250',images:[image,image]},
 {docId:'review-table',title:longText,desc:longText,location:longText,category:'furniture',finalPriceStr:'₹2,500',images:[broken]},
 {docId:'review-phone',title:'નમૂનાનો ફોન · नमूना फ़ोन',desc:longText,location:'સુરત · सूरत',category:'mobiles',finalPriceStr:'₹4,000',images:[image]}
];
const olxCategories=[{id:'furniture',name:'Furniture'},{id:'mobiles',name:'Mobiles'}];
let currentProduct,currentProductSafeImages=[],currentStoreProductsCache=[];
let storeCatalogueGeneration=0,storeCatalogueState,scenario='ready',languageVersion=0,finishLoading;
const saved=new Set();

function openProductDetailPage(id){
 currentProduct=products.find(product=>product.docId===id);
 if(!currentProduct)return;
 renderProductDetailView(currentProduct);
 byId('reviewOverview').hidden=true;
 byId('productDetailView').hidden=false;
 byId('productDetailView').querySelector('[data-review-action="back"]').focus();
}

function toggleCartProduct(id){
 if(saved.has(id))saved.delete(id);else saved.add(id);
 for(const control of document.querySelectorAll('[data-save-button]')){
  if(control.dataset.reviewProduct!==id)continue;
  control.setAttribute('aria-pressed',String(saved.has(id)));
  control.querySelector('i').classList.toggle('text-red-500',saved.has(id));
 }
}

async function readCataloguePage(){
 if(scenario==='loading')await new Promise(resolve=>{finishLoading=resolve;});
 if(scenario==='error'){
  scenario='ready';
  throw new Error('Synthetic catalogue failure');
 }
 return {docs:scenario==='empty'?[]:products.map(product=>({
  id:product.docId,data:()=>({...product,sellerUid:'review-seller'})
 }))};
}

function renderStore(){
 renderStorePublicContent({uid:'review-seller',shopName:'નમૂનાની દુકાન · नमूना दुकान',ownerName:'OLDX',
  address:longText,photoURL:image,categories:olxCategories.map(category=>category.id)},false);
}

const actions={
 back(){byId('productDetailView').hidden=true;byId('reviewOverview').hidden=false;byId('reviewCards').querySelector('[data-card-title]').focus();},
 photos:openLightboxFromDetail,
 close(){closeLightbox();byId('detailImgBadge').focus();},
 previous(){plusLightboxSlide(-1);},next(){plusLightboxSlide(1);},zoom:toggleLightboxZoom
};

for(const control of document.querySelectorAll('[data-review-action]')){
 const action=control.dataset.reviewAction;
 if(action==='counter')control.addEventListener('scroll',updateImageCounter);
 else if(Object.hasOwn(actions,action))control.addEventListener('click',actions[action]);
}
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!byId('imageLightboxModal').hidden)actions.close();
});

byId('reviewCards').append(...products.map(product=>createProductCard(product)));
byId('reviewScenario').addEventListener('change',event=>{
 scenario=event.target.value;
 finishLoading?.();
 finishLoading=undefined;
 renderStore();
});
byId('reviewLocale').addEventListener('change',async event=>{
 const version=++languageVersion;
 const translator=await loadTranslator(event.target.value);
 if(version!==languageVersion)return;
 applyCatalog(document,translator);
 if(storeCatalogueState)filterStoreProducts(window.activeStoreCategoryFilter);
});
await loadTranslator('en').then(translator=>applyCatalog(document,translator));
renderStore();
