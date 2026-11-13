import {Readable} from 'node:stream';

// Inactive, dependency-injected Node HTTP transport for a future Cloud Run host.
// Does not open a port, initialize Firebase, read environment or enable a route.
const routes = new Set([
  '/api/staging/marketplace/save',
  '/api/staging/marketplace/owner',
  '/api/staging/marketplace/archive'
]);
const error = (res, status, code) => {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, {'content-type':'application/json; charset=utf-8',
    'cache-control':'private, no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify({ok:false,error:{code}}));
};

export function createCloudRunMarketplaceListener({enabled=false, handlers={}}={}) {
  return async (req, res) => {
    // Refuse all requests before touching input or any injected handler unless
    // an owner-approved host explicitly enables this transport.
    if (enabled !== true) return error(res,503,'ENFORCEMENT_UNAVAILABLE');
    if (req.method !== 'POST') return error(res,405,'METHOD_NOT_ALLOWED');
    let path;
    try {
      const url = new URL(req.url, 'https://oldx-staging.invalid');
      if (url.search || url.hash || !routes.has(url.pathname) || req.url !== url.pathname) {
        return error(res,404,'NOT_FOUND');
      }
      path = url.pathname;
    } catch { return error(res,400,'BAD_REQUEST'); }
    const operation = path.slice(path.lastIndexOf('/')+1);
    const handler = handlers[operation];
    if (typeof handler?.fetch !== 'function') return error(res,503,'ENFORCEMENT_UNAVAILABLE');
    const cancel = new AbortController();
    const onAbort = () => cancel.abort();
    req.on('aborted',onAbort);
    const onClose = () => { if (!res.writableEnded) cancel.abort(); };
    res.on('close',onClose);
    try {
      const request = new Request('https://oldx-staging.invalid'+path, {
        method:'POST', headers:req.headers,body:Readable.toWeb(req),duplex:'half',signal:cancel.signal
      });
      const answer = await handler.fetch(request);
      if (!(answer instanceof Response)) throw Error('Invalid handler response');
      // Bound memory while reading, including streaming/unknown-length responses.
      if (!answer.body) throw Error('Missing handler response');
      const reader = answer.body.getReader();
      const chunks = []; let total = 0;
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > 65536) throw Error('Oversize handler response');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(()=>{}); }
      const data = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { data.set(chunk,offset); offset += chunk.byteLength; }
      if (res.destroyed || cancel.signal.aborted) return;
      res.writeHead(answer.status,{
        'content-type':'application/json; charset=utf-8',
        'cache-control':'private, no-store',
        'x-content-type-options':'nosniff'
      });
      res.end(data);
    } catch { error(res,503,'ENFORCEMENT_UNAVAILABLE'); }
    finally { req.off('aborted',onAbort);res.off('close',onClose); }
  };
}
