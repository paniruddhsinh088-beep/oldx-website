import {imageContentType} from './mandatory-photos.mjs';
// Client preparation only, never an ownership, moderation or upload proof.
// Canvas re-encoding strips metadata; server inspection remains mandatory.
export async function compressProviderPhoto(file,{signal,createBitmap=globalThis.createImageBitmap,document=globalThis.document}={}){
 if(signal?.aborted||!file||typeof file.arrayBuffer!=='function'||!['image/jpeg','image/png','image/webp'].includes(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>3*1024*1024)throw Error('INVALID_IMAGE');
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size||imageContentType(bytes)!==file.type||signal?.aborted)throw Error('INVALID_IMAGE');
 if(typeof createBitmap!=='function'||!document?.createElement)throw Error('PROCESSOR_UNAVAILABLE');
 const bitmap=await createBitmap(new Blob([bytes],{type:file.type}));
 try{
  if(signal?.aborted||!bitmap.width||!bitmap.height||bitmap.width>8192||bitmap.height>8192||bitmap.width*bitmap.height>24000000)throw Error('INVALID_IMAGE');
  const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('PROCESSOR_UNAVAILABLE');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(signal?.aborted||!blob||blob.type!=='image/jpeg'||blob.size<1||blob.size>2*1024*1024)throw Error('INVALID_IMAGE');
  const output=new Uint8Array(await blob.arrayBuffer());if(signal?.aborted||imageContentType(output)!=='image/jpeg')throw Error('INVALID_IMAGE');return new File([output],'provider-photo.jpg',{type:'image/jpeg'});
 }finally{bitmap.close?.();}
}
