import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStaticAssets } from './build-static-assets.mjs';

// Cloudflare Pages only: an API-specific 404 prevents the default SPA fallback
// from serving index.html for unresolved /api/* requests. Do not add a root
// 404.html: existing hash-routed frontend pages must keep their normal behavior.
// This is not an API proxy or a substitute for backend authentication.
const API_NOT_FOUND = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not Found</title></head><body><h1>Not Found</h1></body></html>\n';

export async function addPagesApiNotFound(output) {
  const apiDirectory = resolve(output, 'api');
  await mkdir(apiDirectory, { recursive: true });
  const path = resolve(apiDirectory, '404.html');
  await writeFile(path, API_NOT_FOUND, { encoding: 'utf8', flag: 'w' });
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await buildStaticAssets();
  await addPagesApiNotFound(output);
  console.log('[OLDX] Cloudflare Pages static assets built with API-only 404 fallback.');
}
