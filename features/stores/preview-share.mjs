// Local sample URLs only. No production Store route, publisher or OG metadata.
export function buildStorePreviewLink(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {ok:false,code:'INVALID_PREVIEW_LINK'};
  const {pageUrl,origin,storeUid}=input;
  if (typeof storeUid!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(storeUid) ||
      typeof pageUrl!=='string' || typeof origin!=='string') return {ok:false,code:'INVALID_PREVIEW_LINK'};
  try {
    const page=new URL(pageUrl), local=['127.0.0.1','localhost','[::1]'].includes(page.hostname);
    if(page.origin!==origin || page.username || page.password ||
       (page.protocol!=='https:' && !(page.protocol==='http:' && local)) ||
       !page.pathname.endsWith('/store-preview.html')) return {ok:false,code:'INVALID_PREVIEW_LINK'};
    page.search=''; page.hash='store/'+storeUid;
    return page.href.length<=2048 ? {ok:true,url:page.href} : {ok:false,code:'INVALID_PREVIEW_LINK'};
  } catch { return {ok:false,code:'INVALID_PREVIEW_LINK'}; }
}
