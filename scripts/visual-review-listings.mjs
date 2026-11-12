// Extract only the reviewed renderers. The production bootstrap is never copied.
function section(source,start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 if(from<0||to<0)throw new Error('Listing review source changed: '+start);
 return source.slice(from,to);
}

function replace(source,pattern,value){
 const result=source.replace(pattern,value);
 if(result===source)throw new Error('Listing review source no longer matches its isolation boundary');
 return result;
}

export function listingReviewSource(homepage){
 const markup=section(homepage,'<div id="productDetailView"','    <!-- SAVED ADS MODAL -->')
  .replace(/\sstyle="display: none;"/g,' hidden')
  .replace(/\son(?:click|scroll)="([^"]+)"/g,(_,action)=>{
   const allowed={
    'closeProductDetailView()':'back','openLightboxFromDetail()':'photos','closeLightbox()':'close',
    'plusLightboxSlide(-1)':'previous','plusLightboxSlide(1)':'next','toggleLightboxZoom()':'zoom','updateImageCounter()':'counter'
   };
   return allowed[action]?' data-review-action="'+allowed[action]+'"':' disabled';
  })
  .replace(/<div class="mt-4 bg-teal-50[^>]*>[\s\S]*?<\/a>\s*<\/div>/,'')
  .replace(/<div id="detailActions"[\s\S]*?(?=\s*<\/div>\s*<!-- IMAGE LIGHTBOX)/,'')
  .replace(/<button type="button" id="product(?:StoreLink|Enquire)"[^>]*>[^<]*<\/button>/g,'');
 let store=section(homepage,'        function isSafeStoreImageUrl(','        function editMyStore(');
 store=replace(store,/            const storeCoords[\s\S]*?(?=            wrap\.innerHTML)/,
  "            const storeCoords = null;\n");
 store=replace(store,/\$\{isOwner \? [\s\S]*?(?=<\/div><\/div><div class="mt-5)/,'');
 store=replace(store,/<button type="button" onclick="shareCurrentStore\(\)"[^>]*>[\s\S]*?<\/button>/,'');
 store=replace(store,/            if \(storeCoords && window\.L\) \{[\s\S]*?(?=            startStoreCatalogue)/,'');
 store=replace(store,/                let query = db\.collection\('products'\)[\s\S]*?const snapshot = await query\.get\(\);/,
  '                const snapshot = await readCataloguePage(state.cursor);');
 const withoutStorage=source=>replace(source,/const storageKey = getSavedAdsStorageKey\(\);\s*const rawList = JSON\.parse\(localStorage\.getItem\(storageKey\) \|\| '\[\]'\);/,
  'const rawList = [];');
 let detail=withoutStorage(section(homepage,'        function renderProductDetailView(','        function shareProductLink('));
 detail=replace(detail,/            const phone = p\.phone[\s\S]*?(?=        \}\s*let lightboxCurrentIndex)/,'');
 detail=replace(detail,"document.getElementById('imageLightboxModal').style.display = 'flex';","document.getElementById('imageLightboxModal').hidden = false;");
 detail=replace(detail,"document.getElementById('imageLightboxModal').style.display = 'none';","document.getElementById('imageLightboxModal').hidden = true;");
 let card=withoutStorage(section(homepage,'        function createProductCard(','    </script>'));
 card=replace(card,"            return card;","            card.querySelector('[data-save-button]').dataset.reviewProduct = p.docId;\n            return card;");
 const styles=section(homepage,'<style>','</style>').slice('<style>'.length);
 if(/\son\w+=|\sstyle=|\b(?:firebase|localStorage|fetch|XMLHttpRequest|WebSocket)\b/i.test(markup+store+detail+card)){
  throw new Error('Unexpected runtime connection or handler in listing review');
 }
 return {markup,styles,renderers:store+detail+card};
}
