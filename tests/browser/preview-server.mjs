import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { BROWSER_ASSETS } from '../../scripts/build-static-assets.mjs';

// Shared loopback-only fixture. Never serves legacy application, Firebase
// configuration, credentials, server modules or arbitrary filesystem paths.
export async function startPreviewServer(pages) {
  const allowed = new Set([...pages.map(page => '/' + page), ...BROWSER_ASSETS
    .filter(path => path.startsWith('features/')).map(path => '/' + path)]);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (!allowed.has(path)) { res.writeHead(404); res.end(); return; }
    try {
      const body = await readFile(new URL('../..' + path, import.meta.url));
      res.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8'
        : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
      res.end(body);
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server;
}
