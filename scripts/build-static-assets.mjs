import { copyFile, mkdir, rm, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberate browser allowlist: never copy functions/, test fixtures, environment
// files other than the generated browser config, or server moderation modules.
export const BROWSER_ASSETS = Object.freeze([
  'mobile-demo.html', 'features/mobile-demo/demo.mjs', 'features/mobile-demo/copy.mjs', 'features/mobile-demo/demo.css', 'features/mobile-demo/sample-art.svg',
  'features/media/compress-provider-photo.mjs', 'features/service-providers/website-photos.mjs', 'features/media/approved-photo-view.mjs', 'features/media/authenticated-photo-client.mjs', 'features/media/mandatory-photos.mjs', 'features/media/mandatory-photos-dom.mjs', 'index.html', 'admin.html', 'service-preview.html', 'service-inbox-preview.html', 'service-buyer-preview.html', 'service-conversation-preview.html', 'service-discovery-preview.html', 'features/chat/message-text.mjs', 'features/marketplace/product-integration.mjs', 'features/marketplace/public-read-client.mjs', 'features/marketplace/authenticated-command-client.mjs', 'features/marketplace/product-route.mjs', 'features/marketplace/session-integration.mjs', 'features/marketplace/navigation-integration.mjs', 'features/marketplace/host-integration.mjs', 'features/marketplace/integration.css', 'features/marketplace/store-integration.mjs', 'features/marketplace/store-integration-dom.mjs', 'features/marketplace/product-integration-dom.mjs', 'features/shared/bounded-read.mjs', 'features/service-providers/preview-inbox.css', 'store-preview.html', 'features/stores/store-preview.css', 'firebase-config-guard.js', 'firebase-env.js',
  ...['service-preview', 'preview-fixtures', 'preview-draft', 'provider-profile', 'service-selections', 'provider-public-profile', 'provider-public-card', 'preview-route', 'provider-mobile-share', 'provider-share', 'preview-enquiry', 'preview-inbox', 'preview-inbox-controller', 'preview-inbox-model', 'preview-inbox-fixtures', 'preview-inbox-route', 'preview-conversation', 'preview-conversation-controller', 'preview-conversation-read', 'provider-discovery', 'preview-discovery-repository', 'preview-discovery-controller', 'ui-integration', 'ui-integration-dom', 'owner-bootstrap-dto', 'enquiry-integration', 'private-integration', 'private-integration-dom', 'private-conversation-dom', 'conversation-integration', 'conversation-dto', 'host-integration', 'enquiry-private-dto']
    .map(name => `features/service-providers/${name}.mjs`),
  ...['store-preview', 'store-catalogue', 'preview-fixtures', 'preview-route', 'preview-load', 'preview-adapter', 'preview-detail', 'preview-share', 'preview-card']
    .map(name => `features/stores/${name}.mjs`),
  ...['i18n', 'dom', 'preference', 'marketplace', 'catalogs/en', 'catalogs/gu', 'catalogs/hi']
    .map(name => `features/i18n/${name}.mjs`)
]);

export async function buildStaticAssets(root = fileURLToPath(new URL('../', import.meta.url))) {
  const source = resolve(root);
  const output = resolve(source, 'public');
  // Refuse source symlinks; a static package must not follow private file links.
  for (const asset of BROWSER_ASSETS) {
    const parts = asset.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const stat = await lstat(resolve(source, ...parts.slice(0, i)));
      if (stat.isSymbolicLink() || (i === parts.length ? !stat.isFile() : !stat.isDirectory())) {
        throw new Error(`Expected regular browser asset: ${asset}`);
      }
    }
  }
  // public/ is exclusively generated output, ignored by Git. Clear stale output
  // so a previous build cannot accidentally publish unallowlisted artifacts.
  await rm(output, { recursive: true, force: true });
  for (const asset of BROWSER_ASSETS) {
    const target = resolve(output, asset);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(source, asset), target);
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildStaticAssets();
  console.log(`[OLDX] Packaged ${BROWSER_ASSETS.length} allowlisted browser assets.`);
}
