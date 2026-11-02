import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { BROWSER_ASSETS } from '../../scripts/build-static-assets.mjs';

// This server deliberately exposes only the isolated preview and its pure
// modules, never index.html, Firebase config, credentials or live integrations.
const allowed = new Set(['/service-preview.html', ...BROWSER_ASSETS
  .filter(path => path.startsWith('features/')).map(path => '/' + path)]);
let server, browser, context, page, origin;
let errors, remoteRequests, requestedPaths;

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
  errors = []; remoteRequests = []; requestedPaths = [];
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) {
      remoteRequests.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.on('request', request => requestedPaths.push(new URL(request.url()).pathname));
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

test('all three interface catalogs switch without changing provider data, drafts or consent', async () => {
  assert.deepEqual(await page.locator('#localeSelect option').evaluateAll(options => options.map(option => option.value)), ['gu', 'en', 'hi']);
  await page.locator('#results article button').first().click();
  const providerName = await page.locator('#pName').textContent();
  const providerAbout = await page.locator('#pAbout').textContent();
  await page.locator('#providerTab').click();
  await page.locator('#providerForm button[type="submit"]').click();
  await page.locator('#providerName').fill('કિરણ / किरण / Kiran');
  await page.locator('#providerDesc').fill('મારા શબ્દો — मेरे शब्द — my words');
  await page.locator('#serviceOptions input[value="સુથાર"]').check();
  await page.locator('#allowPhone').check();
  for (const [locale, expected] of [['en', 'Create your service profile'], ['hi', 'अपनी सेवा प्रोफ़ाइल बनाएँ'], ['gu', 'તમારી સેવા પ્રોફાઇલ બનાવો']]) {
    await page.locator('#localeSelect').selectOption(locale);
    await page.waitForFunction(code => document.documentElement.lang === code, locale);
    assert.equal(await page.locator('#providerHeading').textContent(), expected);
    assert.equal(await page.locator('#providerName').inputValue(), 'કિરણ / किरण / Kiran');
    assert.equal(await page.locator('#providerDesc').inputValue(), 'મારા શબ્દો — मेरे शब्द — my words');
    assert.equal(await page.locator('#previewDescription').textContent(), 'મારા શબ્દો — मेरे शब्द — my words');
    assert.equal(await page.locator('#pName').textContent(), providerName);
    assert.equal(await page.locator('#pAbout').textContent(), providerAbout);
    assert.equal(await page.locator('#allowPhone').isChecked(), true);
    assert.equal(await page.locator('#allowWhatsapp').isChecked(), false);
    assert.equal(await page.locator('#serviceOptions input[value="સુથાર"]').isChecked(), true);
    assert.equal(await page.locator('#providerCityError').textContent() !== '', true);
    assert.equal(await page.locator('#providerView').isVisible(), true);
    const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    assert.deepEqual(stored, { 'oldx.preview.locale.v1': locale });
  }
});

test('only selected catalogs load lazily and the allowlisted preference survives reload', async () => {
  assert.equal(requestedPaths.includes('/features/i18n/catalogs/en.mjs'), true);
  assert.equal(requestedPaths.includes('/features/i18n/catalogs/gu.mjs'), true);
  assert.equal(requestedPaths.includes('/features/i18n/catalogs/hi.mjs'), false);
  await page.locator('#localeSelect').selectOption('hi');
  await page.waitForFunction(() => document.documentElement.lang === 'hi');
  assert.equal(requestedPaths.includes('/features/i18n/catalogs/hi.mjs'), true);
  assert.equal(await page.locator('#browseTab').textContent(), 'सेवाएँ खोजें');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'hi' && document.querySelectorAll('#results article').length === 6);
  assert.equal(await page.locator('#localeSelect').inputValue(), 'hi');
  await page.evaluate(() => localStorage.setItem('oldx.preview.locale.v1', '../../private'));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'gu' && document.querySelectorAll('#results article').length === 6);
});

test('a missing catalog falls back safely and blocked preference storage does not break the UI', async () => {
  await page.route('**/catalogs/hi.mjs', route => route.abort());
  await page.locator('#localeSelect').selectOption('hi');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.match(await page.locator('#localeStatus').textContent(), /could not load/);
  assert.equal(await page.locator('#results article').count(), 6);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#results article').length === 6);
  await page.locator('#localeSelect').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.locator('#providerTab').click();
  await page.locator('#providerName').fill('Test provider');
  assert.equal(await page.locator('#previewName').textContent(), 'Test provider');
});

test('Gujarati, Hindi and English stay within narrow screens and large-text layouts', async () => {
  for (const locale of ['en', 'hi', 'gu']) {
    await page.locator('#localeSelect').selectOption(locale);
    await page.waitForFunction(code => document.documentElement.lang === code, locale);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const tab of ['browseTab', 'providerTab']) {
        await page.locator('#' + tab).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${locale} ${width}px ${tab}`);
      }
    }
  }
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('body *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
    for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`;
  });
  await page.setViewportSize({ width: 320, height: 844 });
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(element => !element.closest('[hidden]') && element.getBoundingClientRect().right > innerWidth + 1)
    .map(element => ({ tag: element.tagName, id: element.id, right: Math.round(element.getBoundingClientRect().right) })).slice(0, 12));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, JSON.stringify(overflow));
});

test('a slow earlier catalog cannot replace the latest language or its stored preference', async () => {
  let release, started;
  const wait = new Promise(resolve => { release = resolve; });
  const requestStarted = new Promise(resolve => { started = resolve; });
  await page.route('**/catalogs/hi.mjs', async route => { started(); await wait; await route.continue(); });
  await page.locator('#localeSelect').selectOption('hi');
  await requestStarted;
  await page.locator('#localeSelect').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  const response = page.waitForResponse('**/catalogs/hi.mjs');
  release();
  await response;
  await page.evaluate(async () => {
    await import('/features/i18n/catalogs/hi.mjs');
    await new Promise(requestAnimationFrame);
  });
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#localeSelect').inputValue(), 'en');
  assert.equal(await page.evaluate(() => localStorage.getItem('oldx.preview.locale.v1')), 'en');
});

test('language changes preserve profile identity and restore focus to the same provider', async () => {
  await page.locator('#sort').selectOption('name');
  const providerId = await page.locator('#results article button').first().getAttribute('data-provider-id');
  await page.locator('#results article button').first().click();
  const name = await page.locator('#pName').textContent();
  await page.locator('#localeSelect').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('#pName').textContent(), name);
  await page.locator('#backBtn').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.providerId), providerId);
  assert.equal(await page.locator('[data-i18n] input').count(), 0);
});

test('each language supports actual 200 percent text across all preview views', async () => {
  for (const locale of ['en', 'hi', 'gu']) {
    await page.goto(origin + '/service-preview.html');
    await page.waitForFunction(() => document.querySelectorAll('#results article').length === 6);
    await page.locator('#localeSelect').selectOption(locale);
    await page.waitForFunction(code => document.documentElement.lang === code, locale);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('body *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`;
    });
    async function checkOverflow(view) {
      const diagnostics = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter(element => !element.closest('[hidden]') && element.getBoundingClientRect().right > innerWidth + 1)
        .map(element => ({ tag: element.tagName, id: element.id, class: element.className, right: Math.round(element.getBoundingClientRect().right) })).slice(0, 12));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${locale} large text ${view}: ${JSON.stringify(diagnostics)}`);
    }
    await page.locator('#browseTab').click();
    await checkOverflow('discovery');
    await page.locator('#results article button').first().click();
    await checkOverflow('profile');
    await page.locator('#providerTab').click();
    await checkOverflow('onboarding');
  }
});

test('direct preview links reload, support history, and clear unknown profiles', async () => {
  await page.goto(origin + '/service-preview.html#provider/p1');
  await page.waitForFunction(() => document.querySelector('#profileView').hidden === false);
  const name = await page.locator('#pName').textContent();
  assert.ok(name.length > 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#profileLink').value.endsWith('#provider/p1'));
  assert.equal(await page.locator('#pName').textContent(), name);
  await page.locator('#providerTab').click();
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#profileView').hidden === false);
  assert.equal(await page.locator('#pName').textContent(), name);
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('#providerView').hidden === false);
  await page.evaluate(() => { location.hash = '#provider/missing'; });
  await page.waitForFunction(() => document.querySelector('#notFoundView').hidden === false);
  assert.equal(await page.locator('#pName').textContent(), '');
  assert.equal(await page.locator('#profileLink').inputValue(), '');
  assert.equal(await page.locator('#copyProfileLink').isDisabled(), true);
  assert.equal(await page.locator('#notFoundHeading').evaluate(el => el === document.activeElement), true);
  await page.locator('#notFoundBack').click();
  assert.equal(await page.locator('#browseView').isVisible(), true);
});

test('copy shares only the synthetic profile link without query or draft data', async () => {
  await page.goto(origin + '/service-preview.html?privateToken=secret#provider/p1');
  await page.waitForFunction(() => document.querySelector('#profileLink').value !== '');
  await page.evaluate(() => {
    window.copies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.copies.push(value) } });
  });
  await page.locator('#copyProfileLink').click();
  await page.waitForFunction(() => window.copies.length === 1 && !document.querySelector('#copyProfileLink').disabled);
  assert.deepEqual(await page.evaluate(() => window.copies), [origin + '/service-preview.html#provider/p1']);
  assert.equal(await page.locator('#profileLink').inputValue(), origin + '/service-preview.html#provider/p1');
});

test('native cancellation never copies and stale async copy cannot update another route', async () => {
  await page.locator('#results article button').first().click();
  await page.evaluate(() => {
    window.copies = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.copies.push(value) } });
  });
  await page.locator('#shareProfileLink').click();
  await page.waitForFunction(() => !document.querySelector('#shareProfileLink').disabled);
  assert.deepEqual(await page.evaluate(() => window.copies), []);
  assert.ok((await page.locator('#profileShareStatus').textContent()).length > 0);
  await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise(resolve => { window.finishCopy = resolve; }); });
  await page.locator('#copyProfileLink').click();
  await page.waitForFunction(() => typeof window.finishCopy === 'function');
  await page.locator('#providerTab').click();
  await page.evaluate(() => window.finishCopy());
  assert.equal(await page.locator('#profileShareStatus').textContent(), '');
  assert.equal(await page.locator('#copyProfileLink').isDisabled(), true);
});

test('denied clipboard keeps a selectable link and localized recovery in every language', async () => {
  await page.locator('#results article button').first().click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
  });
  for (const locale of ['en', 'hi', 'gu']) {
    await page.locator('#localeSelect').selectOption(locale);
    await page.waitForFunction(code => document.documentElement.lang === code, locale);
    await page.locator('#copyProfileLink').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#copyProfileLink').disabled);
    const catalog = (await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#profileShareStatus').textContent(), catalog.previewShareUnavailable);
    assert.equal(await page.locator('#profileLink').inputValue(), origin + '/service-preview.html#provider/p1');
  }
  await page.evaluate(() => { location.hash = '#provider/unknown'; });
  await page.waitForFunction(() => !document.querySelector('#notFoundView').hidden);
  for (const locale of ['en', 'hi', 'gu']) {
    await page.locator('#localeSelect').selectOption(locale);
    await page.waitForFunction(code => document.documentElement.lang === code, locale);
    const catalog = (await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#notFoundHeading').textContent(), catalog.previewNotFoundHeading);
  }
});
