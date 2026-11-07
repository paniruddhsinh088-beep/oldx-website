import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
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
  await writeFile(resolve(output, '_redirects'), '/api /api/unavailable 308\n', 'utf8');
  return path;
}

export async function buildCloudflarePages(root = fileURLToPath(new URL('../', import.meta.url))) {
  const configPath = resolve(root, 'firebase-env.js');
  if (!(await lstat(configPath)).isFile()) throw new Error('Expected generated Firebase browser config.');
  const source = await readFile(configPath, 'utf8');
  const match = /^"use strict";\nwindow\.OLDX_FIREBASE_CONFIG = Object\.freeze\(([^\r\n]+)\);\n$/.exec(source);
  const config = match && JSON.parse(match[1]);
  const fields = ['apiKey', 'appId', 'authDomain', 'environment', 'messagingSenderId', 'projectId', 'storageBucket'];
  if (config?.environment !== 'staging' || config.projectId !== 'oldx-staging' ||
      Object.keys(config).sort().join(',') !== fields.join(',') ||
      fields.some(field => typeof config[field] !== 'string' || !config[field].trim()) ||
      [config.authDomain, config.storageBucket].some(value => value.includes('oldx-1c983'))) {
    throw new Error('Cloudflare Pages requires generated staging Firebase browser config.');
  }
  const output = await buildStaticAssets(root);
  await addPagesApiNotFound(output);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildCloudflarePages();
  console.log('[OLDX] Cloudflare Pages staging assets built with API 404 routing.');
}
