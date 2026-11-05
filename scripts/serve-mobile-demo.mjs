import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {BROWSER_ASSETS} from './build-static-assets.mjs';
const pages=['mobile-demo.html','service-preview.html','store-preview.html','service-inbox-preview.html','service-buyer-preview.html','service-conversation-preview.html','service-discovery-preview.html'];
// Local demonstration server, not a deployment. Never serve legacy pages,
// Firebase config, source backend, .git, credentials or arbitrary paths.
export function createMobileDemoServer(){
 const allowed=new Set([...pages,...BROWSER_ASSETS.filter(p=>p.startsWith('features/'))]);
 return createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname,path=pathname==='/'?'mobile-demo.html':pathname.slice(1);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  if(!allowed.has(path)){res.writeHead(404);res.end();return;}
  try{const bytes=await readFile(new URL('../'+path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const host=process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1';createMobileDemoServer().listen(8080,host,()=>console.log('Synthetic OLDX demo: http://'+(host==='0.0.0.0'?'<your-computer-LAN-IP>':host)+':8080/mobile-demo.html · No live services.'));}
