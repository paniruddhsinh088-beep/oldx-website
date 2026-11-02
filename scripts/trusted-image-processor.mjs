import {createHash} from 'node:crypto';
import {getSurfacePolicy,validateProcessedImage} from './image-upload-contract-policy.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// Server-only isolated processor. Sharp is loaded lazily; bytes only, never URLs,
// paths, credentials, browser/Capacitor code or an activated upload endpoint.
export function createTrustedImageProcessor({enabled=false,mode,scan,maxInputPixels=12000000,timeoutMs=2500,maxConcurrency=2}={}){
 let running=0;
 return Object.freeze({async process(input,{surface,signal}={}){
  if(enabled!==true||mode!=='isolated-test')return {ok:false,code:'UNAVAILABLE'};
  const policy=getSurfacePolicy(surface);if(!policy||!(input instanceof Uint8Array)||input.byteLength<1||input.byteLength>3*1024*1024||!Number.isSafeInteger(maxInputPixels)||maxInputPixels<1||maxInputPixels>12000000||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)return {ok:false,code:'INVALID_IMAGE'};
  if(!Number.isInteger(maxConcurrency)||maxConcurrency<1||maxConcurrency>4)return {ok:false,code:'UNAVAILABLE'};
  if(running>=maxConcurrency)return {ok:false,code:'BUSY'};
  if(signal?.aborted)return {ok:false,code:'CANCELLED'};
  const source=Buffer.from(input);const format=source[0]===0xff&&source[1]===0xd8&&source[2]===0xff?'jpeg':source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':source.subarray(0,4).toString()==='RIFF'&&source.subarray(8,12).toString()==='WEBP'?'webp':null;if(!format)return {ok:false,code:'IMAGE_REJECTED'};running++;const sourceDigest=digest(source),controller=new AbortController();let pipeline,timer,stop;
  const abort=()=>{controller.abort();pipeline?.destroy();stop?.();};signal?.addEventListener('abort',abort,{once:true});
  try{
   const stopped=new Promise((_,reject)=>{stop=()=>reject(new Error('Image processing stopped'));timer=setTimeout(abort,timeoutMs);});
   const work=(async()=>{
    const {default:sharp}=await import('sharp');if(controller.signal.aborted)throw new Error('Stopped');
    pipeline=sharp(source,{limitInputPixels:maxInputPixels,failOn:'warning',sequentialRead:true});
    const meta=await pipeline.metadata();if(controller.signal.aborted||meta.format!==format||(meta.pages??1)!==1||!Number.isSafeInteger(meta.width)||!Number.isSafeInteger(meta.height)||meta.width<1||meta.height<1||meta.width*meta.height>maxInputPixels)throw new Error('Invalid raster');
    const output=await pipeline.rotate().resize({width:policy.maxDimension,height:policy.maxDimension,fit:'inside',withoutEnlargement:true}).webp({quality:80,alphaQuality:80,effort:3}).timeout({seconds:Math.max(1,Math.ceil(timeoutMs/1000))}).toBuffer({resolveWithObject:true});
    if(controller.signal.aborted||output.data.byteLength>Math.min(3*1024*1024,policy.maxBytes)||!validateProcessedImage({surface,contentType:'image/webp',byteSize:output.data.byteLength,width:output.info.width,height:output.info.height,fileCount:1}).ok)throw new Error('Output limit');
    const metadata=await sharp(output.data,{limitInputPixels:maxInputPixels,failOn:'warning'}).metadata();
    if(controller.signal.aborted||metadata.exif||metadata.xmp||metadata.iptc||metadata.icc||metadata.orientation||metadata.format!=='webp'||(metadata.pages??1)!==1)throw new Error('Metadata survived');
    const processedDigest=digest(output.data),descriptor={contentType:'image/webp',byteSize:output.data.byteLength,width:output.info.width,height:output.info.height,sourceDigest,processedDigest,metadataStripped:true};
    let contentScanned=false;if(typeof scan==='function'){const verdict=await scan({bytes:new Uint8Array(output.data),...descriptor},{signal:controller.signal});if(verdict?.allowed!==true)return {ok:false,code:verdict?.allowed===false?'CONTENT_REJECTED':'SCAN_UNAVAILABLE'};contentScanned=true;}
    if(controller.signal.aborted)throw new Error('Stopped');return {ok:true,status:contentScanned?'processed':'awaiting-scan',bytes:new Uint8Array(output.data),...descriptor,contentScanned};
   })();
   return await Promise.race([work,stopped]);
  }catch{return {ok:false,code:signal?.aborted?'CANCELLED':controller.signal.aborted?'DEADLINE_EXCEEDED':'IMAGE_REJECTED'};}
  finally{running--;clearTimeout(timer);signal?.removeEventListener('abort',abort);pipeline?.destroy();}
 }});
}
