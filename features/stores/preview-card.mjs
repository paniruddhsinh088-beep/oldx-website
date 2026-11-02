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
    let y=66;
    const lines=(value,size,font,fill,bold=false)=>wrapCardText(value,size).map(line=>{
      const row=`<text x="48" y="${y}" font-size="${font}" fill="${fill}"${bold?' font-weight="700"':''}>${xml(line)}</text>`;
      y+=font+14;return row;
    }).join('');
    const badge=lines(input.labels.badge,30,18,'#a7f3d0',true); y+=36;
    const name=lines(input.store.name,16,36,'#ffffff',true); y+=22;
    const category=lines(input.category,26,23,'#a7f3d0'); y+=12;
    const city=lines(input.store.city,24,24,'#ffffff'); y+=36;
    const caption=lines(input.labels.caption,36,17,'#dbeafe'); y+=10;
    const url=lines(link.url,42,14,'#ffffff'); const height=y+34;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" role="img" aria-labelledby="cardTitle cardDescription" font-family="system-ui, Noto Sans Gujarati, Noto Sans Devanagari, sans-serif"><title id="cardTitle">${xml(input.labels.badge+' · '+input.store.name)}</title><desc id="cardDescription">${xml(input.labels.caption+' · '+input.category+' · '+input.store.city+' · '+link.url)}</desc><defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="#102c46"/><stop offset="1" stop-color="#126c68"/></linearGradient></defs><rect width="720" height="${height}" rx="28" fill="url(#background)"/>${badge}${name}${category}${city}${caption}${url}</svg>`;
    if (svg.length>32768) return invalid();
    return {ok:true,value:{svg,filename:`oldx-sample-store-${input.store.id}.svg`,
      name:input.store.name,city:input.store.city,category:input.category,url:link.url,
      badge:input.labels.badge,caption:input.labels.caption}};
  } catch { return invalid(); }
}

export async function exportStorePreviewCard(input, browser, isCurrent=()=>true) {
  const card=buildStorePreviewCard(input);
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
