const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
// Existing Product/edit hash conventions; private IDs are routing hints only.
// No token, text, UID or draft is placed in URLs. Other feature routes pass through.
export function parseProductRoute(hash){if(hash===''||hash==='#')return {page:'home'};if(hash==='#sell')return {page:'sell'};if(hash==='#search')return {page:'search'};for(const [prefix,page]of [['#product-','product'],['#edit-','owner'],['#chat-','thread']])if(typeof hash==='string'&&hash.startsWith(prefix)){const value=hash.slice(prefix.length);return id(value)?{page,id:value}:{page:'unavailable'};}return null;}
export function productRoute(page,value){if(page==='home')return '';const prefix={product:'#product-',owner:'#edit-',thread:'#chat-'}[page];return prefix&&id(value)?prefix+value:null;}
