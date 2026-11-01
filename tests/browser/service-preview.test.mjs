import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// This server deliberately exposes only the isolated preview and its pure
// modules, never index.html, Firebase config, credentials or live integrations.
const allowed = new Set(['/service-preview.html', ...[
  'service-preview', 'preview-fixtures', 'preview-draft', 'provider-profile', 'service-selections'
].map(name => `/features/service-providers/${name}.mjs`)]);
let server, browser, context, page, origin;
let errors, remoteRequests;

before(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (!allowed.has(path)) { res.writeHead(404); res.end(); return; }
    try {
      const body = await readFile(new URL('../..' + path, import.meta.url));
      res.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
      res.end(body);
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
beforeEach(async () => {
  errors = []; remoteRequests = [];
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) {
      remoteRequests.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/service-preview.html');
  await page.waitForFunction(() => document.querySelectorAll('#results article').length === 6);
});
afterEach(async () => {
  await context?.close();
  assert.deepEqual(errors, [], 'browser exceptions');
  assert.deepEqual(remoteRequests, [], 'preview must not contact a remote service');
});

test('discovery filters compose, recover from empty results, and reset with keyboard focus', async () => {
  await page.locator('#availableOnly').check();
  assert.equal(await page.locator('#results article').count(), 5);
  await page.locator('[data-cat="પ્લમ્બર"]').click();
  assert.equal(await page.locator('#results article').count(), 0);
  assert.equal(await page.locator('[data-cat="પ્લમ્બર"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#resetSearch').click();
  assert.equal(await page.locator('#results article').count(), 6);
  assert.equal(await page.locator('#q').evaluate(el => el === document.activeElement), true);
  await page.locator('#q').fill('ફર્નિચર');
  assert.equal(await page.locator('#results article').count(), 1);
  await page.locator('#area').fill('અજ્ઞાત વિસ્તાર');
  assert.equal(await page.locator('#results article').count(), 0);
});

test('profile navigation hides incompatible views, moves focus, and restores result focus', async () => {
  const button = page.locator('#results article button').first();
  await button.click();
  assert.equal(await page.locator('#profileView').isVisible(), true);
  assert.equal(await page.locator('#browseView').isVisible(), false);
  assert.equal(await page.locator('#pName').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('.contact-demo:disabled').count(), 3);
  await page.locator('#backBtn').click();
  assert.equal(await button.evaluate(el => el === document.activeElement), true);
  await page.locator('#providerTab').click();
  assert.equal(await page.locator('#profileView').isVisible(), false);
  assert.equal(await page.locator('#providerHeading').evaluate(el => el === document.activeElement), true);
});

test('draft reports errors then validates multiple services without publishing or persisting', async () => {
  await page.locator('#providerTab').click();
  await page.locator('#providerForm button[type="submit"]').click();
  assert.equal(await page.locator('#providerName').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#providerName').evaluate(el => el === document.activeElement), true);
  await page.locator('#providerName').fill('કિરણભાઈ');
  await page.locator('#providerCity').fill('અમદાવાદ');
  await page.locator('#providerArea').fill('બોપલ');
  await page.locator('#serviceOptions input[value="સુથાર"]').check();
  await page.locator('#serviceOptions input[value="પ્લમ્બર"]').check();
  await page.locator('#providerExp').fill('1.5');
  assert.equal(await page.locator('#providerExp').getAttribute('aria-invalid'), 'true');
  await page.locator('#providerExp').fill('');
  await page.locator('#providerExp').pressSequentially('e');
  assert.equal(await page.locator('#providerExp').evaluate(el => el.validity.badInput), true);
  assert.equal(await page.locator('#providerExp').getAttribute('aria-invalid'), 'true');
  await page.locator('#providerExp').fill('7');
  await page.locator('#providerDesc').fill('ઘર અને ઓફિસમાં કામ');
  await page.locator('#providerForm button[type="submit"]').click();
  assert.match(await page.locator('#validationStatus').textContent(), /માન્ય છે/);
  assert.match(await page.locator('#completionText').textContent(), /4 \/ 4/);
  assert.equal(await page.locator('#previewDescription').textContent(), 'ઘર અને ઓફિસમાં કામ');
  assert.equal(await page.locator('#validationStatus').evaluate(el => el === document.activeElement), true);
  await page.reload();
  assert.equal(await page.locator('#providerName').inputValue(), '');
});

test('consent toggles stay independent and untrusted text cannot create DOM elements', async () => {
  await page.locator('#providerTab').click();
  assert.equal(await page.locator('#allowPhone').isChecked(), false);
  assert.equal(await page.locator('#allowWhatsapp').isChecked(), false);
  await page.locator('#allowPhone').check();
  assert.equal(await page.locator('#allowWhatsapp').isChecked(), false);
  await page.locator('#providerName').fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#previewName img').count(), 0);
  assert.match(await page.locator('#previewName').textContent(), /<img/);
  await page.locator('#providerForm button[type="submit"]').click();
  assert.equal(await page.locator('#providerName').getAttribute('aria-invalid'), 'true');
});

test('320px mobile and desktop views have no horizontal overflow or inaccessible form controls', async () => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tab of ['browseTab', 'providerTab']) {
      await page.locator('#' + tab).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px ${tab}`);
    }
  }
  assert.equal(await page.locator('#providerForm input').evaluateAll(inputs => inputs.every(el => el.labels.length > 0)), true);
});
