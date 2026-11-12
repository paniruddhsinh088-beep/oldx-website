function section(source,start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 if(from<0||to<0)throw new Error('Services review source changed: '+start);
 return source.slice(from,to);
}

export function servicesReviewSource(html,source){
 const styles=section(html,'<style>','</style>').slice(7);
 const browse=section(html,'<section id="browseView"','<section id="profileView"');
 const profile=section(html,'<section id="profileView"','<div class="profile-section"><h3 data-i18n="previewShareHeading"');
 const render=section(source,'function render() {','function show(');
 const detail=section(source,'  $("pName").textContent = p.displayName;','  prepareProfileLink();');
 const markup=browse+profile+'</div></div></section>';
 // Keep extraction fail-closed when the real view starts depending on new I/O or private controls.
 if(/\son\w+=|\s(?:src|href|action|style)=|<(?:script|iframe|object)\b|\b(?:firebase|fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|navigator|profileLink|enquiryService|providerApprovedPhotos)\b/i.test(markup+render+detail)
  || /@import|url\s*\(/i.test(styles)){
  throw new Error('Unexpected runtime connection or private control in Services review');
 }
 return {markup,styles:styles+'\n.profile-layout{grid-template-columns:minmax(0,1fr)} .demo code{overflow-wrap:anywhere}',
  renderers:render+'\nfunction renderPublicProfile(p){\n'+detail+'}\n'};
}
