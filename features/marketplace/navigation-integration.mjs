const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const privateScope=v=>{try{return v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')==='enquiryId,providerId'&&['providerId','enquiryId'].every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')&&id(v[k]));}catch{return false;}};
// Shared host routing port, not another query/auth model. Native hosts may supply
// the same bindings. There is no URL navigation, network or automatic activation.
export function createMarketplaceNavigation({enabled=false,product,store,providers,onView=()=>{}}={}){
 let version=0;const bindings=[product,store,providers].filter(Boolean);
 function cancel(){version++;for(const binding of bindings)binding.changeScope?.();}
 return Object.freeze({clear:cancel,async go(page,value=null){
  if(!enabled||!['home','product','store','stores','providers','provider','enquiry','inbox','conversation'].includes(page)||['product','store','provider','enquiry'].includes(page)&&!id(value)||page==='inbox'&&!id(value)&&!privateScope(value)||page==='conversation'&&!privateScope(value))return false;
  const required={home:product?.discover,product:product?.openProduct,store:store?.open,stores:store?.discover,providers:providers?.discover,provider:providers?.detail,enquiry:providers?.openEnquiry,inbox:providers?.openInbox,conversation:providers?.openConversation};if(typeof required[page]!=='function')return false;
  cancel();const current=version;const action={home:()=>product?.discover?.(),product:()=>product?.openProduct?.(value),store:()=>store?.open?.(value),stores:()=>store?.discover?.(),providers:()=>providers?.discover?.({category:'',locality:'',limit:12,cursor:null}),provider:()=>providers?.detail?.({providerId:value,expectedGeneration:null}),enquiry:()=>providers?.openEnquiry?.(value),inbox:()=>providers?.openInbox?.(value),conversation:()=>providers?.openConversation?.(value)}[page];
  try{onView({page,id:value,status:'loading'});const result=await action();if(result===false){if(current===version)onView({page,id:value,status:'unavailable'});return false;}if(current!==version)return false;onView({page,id:value,status:'ready'});return true;}catch{if(current===version)onView({page,id:value,status:'unavailable'});return false;}
 }});
}
