/** Isolated moderation UI. Host must provide authenticated admin adapter callbacks. */
export function mountServiceModeration(container,{loadPending,onModerate}={}) {
 if (!(container instanceof HTMLElement)) throw new TypeError("Container required.");
 if (typeof loadPending!=="function"||typeof onModerate!=="function") throw new TypeError("Moderation callbacks required.");
 const root=document.createElement("section");
 const heading=document.createElement("h2");heading.textContent="Pending service providers";
 const status=document.createElement("p");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 const list=document.createElement("div");
 const reload=document.createElement("button");reload.type="button";reload.textContent="Refresh pending";
 root.append(heading,reload,status,list);
 let busy=false,disposed=false;
 async function refresh(){
  if(busy||disposed)return;
  busy=true;reload.disabled=true;status.textContent="Loading pending profiles…";
  try {
   const profiles=await loadPending();
   if(disposed)return;
   list.replaceChildren();
   const safe=Array.isArray(profiles)?profiles:[];
   for(const profile of safe){
    if(profile?.status!=="pending"||typeof profile.id!=="string")continue;
    const card=document.createElement("article");
    const name=document.createElement("strong");name.textContent=String(profile.displayName||"Unnamed provider");
    const location=document.createElement("p");location.textContent=String(profile.city||"");
    card.append(name,location);
    for(const [label,nextStatus] of [["Approve","active"],["Suspend","suspended"]]){
     const button=document.createElement("button");button.type="button";button.textContent=label;
     button.addEventListener("click",async()=>{
      if(busy||disposed)return;
      busy=true;button.disabled=true;status.textContent="Updating provider…";
      try{await onModerate(profile.id,nextStatus);status.textContent="Status updated.";}
      catch{status.textContent="Update failed. Check permissions and retry.";}
      finally{busy=false;button.disabled=false;}
      if(!disposed && status.textContent==="Status updated.")await refresh();
     });
     card.append(button);
    }
    list.append(card);
   }
   status.textContent=list.children.length?`${list.children.length} pending profile(s).`:"No pending profiles.";
  }catch{if(!disposed)status.textContent="Unable to load pending profiles. Check admin permissions.";}
  finally{busy=false;if(!disposed)reload.disabled=false;}
 }
 reload.addEventListener("click",refresh);
 container.replaceChildren(root);
 return {refresh,destroy(){disposed=true;root.remove();}};
}
