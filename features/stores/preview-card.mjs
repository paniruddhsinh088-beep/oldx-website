import { buildStorePreviewLink } from './preview-share.mjs';
const safeText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[<>\u0000-\u001f\u007f-\u009f]/u.test(value);
const xml = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function wrapCardText(value, size) {
  // Never split Gujarati/Hindi combining sequences or emoji clusters.
  const pieces = [...new Intl.Segmenter('und', {granularity:'grapheme'}).segment(value)].map(p=>p.segment);
  return Array.from({length:Math.ceil(pieces.length/size)},(_,i)=>pieces.slice(i*size,(i+1)*size).join(''));
}
// Pure public SAMPLE data only; no authorization, remote images/fonts or QR API.
export function buildStorePreviewCard(input) {
  const invalid = () => ({ok:false,code:'INVALID_SAMPLE_CARD'});
  if (!input || typeof input !== 'object' || !input.store || !input.labels ||
      !safeText(input.store.name,120) || !safeText(input.store.city,120) ||
      !safeText(input.category,160) || !safeText(input.labels.badge,100) || !safeText(input.labels.caption,160)) return invalid();
  const link = buildStorePreviewLink({pageUrl:input.pageUrl,origin:input.origin,storeUid:input.store.id});
  if (!link.ok) return invalid();
  try {
    return renderStoreCard({...input,city:input.store.city,url:link.url,filename:`oldx-sample-store-${input.store.id}.svg`});
  } catch { return invalid(); }
}


function renderStoreCard({store,category,labels,url,filename,city=''}) {
  let y=112;
  const lines=(value,size,font,fill,bold=false)=>wrapCardText(value,size).map(line=>{
    const row=`<text x="48" y="${y}" font-size="${font}" fill="${fill}"${bold?' font-weight="700"':''}>${xml(line)}</text>`;
    y+=font+14;return row;
  }).join('');
  const badge=lines(labels.badge,30,18,'#93400e',true);y+=20;
  const name=lines(store.name,16,36,'#102a43',true);y+=16;
  const categories=lines(category,26,23,'#254c85');
  const location=city?lines(city,24,22,'#254c85'):'';
  y+=24;
  const caption=lines(labels.caption,36,17,'#102a43',true);
  const address=lines(url,42,14,'#254c85'),height=y+34;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" role="img" aria-labelledby="cardTitle cardDescription" font-family="system-ui, Noto Sans Gujarati, Noto Sans Devanagari, sans-serif"><title id="cardTitle">${xml(labels.badge+' · '+store.name)}</title><desc id="cardDescription">${xml([labels.caption,category,city,url].filter(Boolean).join(' · '))}</desc><rect width="720" height="${height}" rx="28" fill="#ffffff"/><path d="M28 0H692Q720 0 720 28V72H0V28Q0 0 28 0Z" fill="#102a43"/><text x="48" y="48" fill="#ffffff" font-size="30" font-weight="800">OLD<tspan fill="#fb923c">X</tspan></text><rect x="0" y="72" width="720" height="5" fill="#f97316"/>${badge}${name}${categories}${location}${caption}${address}</svg>`;
  return svg.length>32768?{ok:false,code:'INVALID_STORE_CARD'}:{ok:true,value:{
    svg,filename,name:store.name,city,category,url,badge:labels.badge,caption:labels.caption
  }};
}

// The caller supplies only a Store accepted by the opt-in public read.
export function buildPublicStoreCard({store,category,caption,pageUrl,origin}={}) {
  const invalid={ok:false,code:'INVALID_STORE_CARD'};
  if(store?.kind!=='store'||typeof store.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(store.id)||
    !Number.isSafeInteger(store.revision)||store.revision<1||!safeText(store.name,120)||
    !safeText(category,160)||!safeText(caption,160))return invalid;
  try {
    const page=new URL(pageUrl),local=['127.0.0.1','localhost','[::1]'].includes(page.hostname);
    if(page.origin!==origin||page.username||page.password||
       (page.protocol!=='https:'&&!(page.protocol==='http:'&&local))||page.hash!=='#store-'+store.id)return invalid;
    page.search='';
    if(page.href.length>2048)return invalid;
    return renderStoreCard({store,category,labels:{badge:'OLDX',caption},url:page.href,filename:`oldx-store-${store.id}.svg`});
  } catch {return invalid;}
}

export function storeCardDownloadBrowser(root) {
  const view=root.defaultView;
  return {
    ready:async()=>{await root.fonts?.ready;},
    createBlob:(svg,type)=>new view.Blob([svg],{type}),
    createObjectURL:blob=>view.URL.createObjectURL(blob),
    revokeObjectURL:url=>view.URL.revokeObjectURL(url),
    download(url,filename){
      const link=root.createElement('a');link.href=url;link.download=filename;
      root.body.append(link);try{link.click();}finally{link.remove();}
    }
  };
}

export async function exportStorePreviewCard(input,browser,isCurrent){
  return exportStoreCard(buildStorePreviewCard(input),browser,isCurrent);
}

export async function exportStoreCard(card,browser,isCurrent=()=>true) {
  if(!card.ok)return card;
  if(!browser || !['createBlob','createObjectURL','revokeObjectURL','download'].every(key=>typeof browser[key]==='function')) return {ok:false,code:'EXPORT_UNAVAILABLE'};
  let url;
  try {
    if(typeof browser.ready==='function')await browser.ready();
    if(!isCurrent())return {ok:false,code:'EXPORT_CANCELLED'};
    const blob=browser.createBlob(card.value.svg,'image/svg+xml');
    url=browser.createObjectURL(blob);
    if(!isCurrent())return {ok:false,code:'EXPORT_CANCELLED'};
    await browser.download(url,card.value.filename);
    return isCurrent()?{ok:true}:{ok:false,code:'EXPORT_CANCELLED'};
  } catch { return {ok:false,code:'EXPORT_UNAVAILABLE'}; }
  finally { if(url!==undefined){try{browser.revokeObjectURL(url);}catch{ /* No raw browser errors are exposed. */ }} }
}
