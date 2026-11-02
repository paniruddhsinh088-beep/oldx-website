import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startPreviewServer } from './preview-server.mjs';

let server, browser, context, page, origin, errors, remoteRequests;
before(async () => {
  server = await startPreviewServer(['store-preview.html', 'service-preview.html']);
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
beforeEach(async () => {
  errors = []; remoteRequests = [];
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) { remoteRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/store-preview.html');
  await page.waitForFunction(() => document.querySelectorAll('#results article').length === 6);
});
afterEach(async () => { await context?.close(); assert.deepEqual(errors, [], 'browser exceptions'); assert.deepEqual(remoteRequests, [], 'no remote integrations'); });
const ids = () => page.locator('#results article').evaluateAll(nodes => nodes.map(node => node.dataset.productId));
async function language(locale) {
  await page.locator('#localeSelect').selectOption(locale);
  await page.waitForFunction(code => document.documentElement.lang === code, locale);
}
async function route(hash, view) {
  await page.evaluate(hash => { location.hash = hash; }, hash);
  await page.waitForFunction(id => !document.getElementById(id).hidden, view);
}

test('bounded discovery composes availability, category and title filters and resets pagination', async () => {
  assert.deepEqual(await ids(), ['sample-13', 'sample-12', 'sample-11', 'sample-10', 'sample-9', 'sample-8']);
  assert.equal(await page.locator('#previous').isDisabled(), true);
  await page.locator('#next').click();
  assert.equal(await page.locator('#resultsHeading').evaluate(el => el === document.activeElement), true);
  await page.locator('#next').click();
  assert.deepEqual(await ids(), ['sample-1']);
  assert.equal(await page.locator('#next').isDisabled(), true);
  await page.locator('#availableOnly').check();
  assert.equal((await ids()).length, 6);
  assert.equal(await page.locator('#previous').isDisabled(), true);
  await page.locator('#category').selectOption('furniture');
  assert.deepEqual(await ids(), ['sample-12', 'sample-7', 'sample-1']);
  await page.locator('#query').fill('ખુરશી');
  assert.deepEqual(await ids(), ['sample-1']);
  await page.locator('#query').fill('no matching sample');
  assert.equal(await page.locator('#emptyState').isVisible(), true);
  assert.deepEqual(await ids(), []);
  await page.locator('#reset').click();
  assert.equal((await ids()).length, 6);
  assert.equal(await page.locator('#query').evaluate(el => el === document.activeElement), true);
});

test('sort uses numeric prices, newest timestamps and authored names', async () => {
  await page.locator('#sort').selectOption('price-low');
  assert.deepEqual(await ids(), ['sample-5', 'sample-11', 'sample-3', 'sample-13', 'sample-8', 'sample-6']);
  assert.equal(await page.locator('#results .price').first().textContent(), '₹150');
  await page.locator('#sort').selectOption('price-high');
  assert.equal((await ids())[0], 'sample-2');
  await page.locator('#sort').selectOption('name');
  assert.equal((await ids()).length, 6);
  await page.locator('#sort').selectOption('newest');
  assert.equal((await ids())[0], 'sample-13');
});

test('direct product reload/history preserves selection, filters and result focus', async () => {
  await page.locator('#category').selectOption('books');
  const first = page.locator('#results a').first();
  const title = await page.locator('#results h3').first().textContent();
  await first.click();
  await page.waitForFunction(() => !document.querySelector('#productView').hidden);
  assert.equal(await page.locator('#productTitle').textContent(), title);
  assert.equal(await page.locator('#productTitle').evaluate(el => el === document.activeElement), true);
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector('#catalogueView').hidden);
  assert.equal(await page.locator('#category').inputValue(), 'books');
  assert.equal(await first.evaluate(el => el === document.activeElement), true);
  await page.goForward();
  await page.waitForFunction(() => !document.querySelector('#productView').hidden);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#productTitle').textContent.length > 0);
  assert.equal(await page.locator('#productTitle').textContent(), title);
});

test('empty shop and invalid links recover without stale product data', async () => {
  await route('#store/demo-shop/product/sample-1', 'productView');
  for (const hash of ['#store/demo-shop/product/missing', '#store/unknown', '#store/demo-shop/product/%2Fprivate']) {
    await route(hash, 'notFoundView');
    assert.equal(await page.locator('#productTitle').textContent(), '');
    assert.equal(await page.locator('#productPrice').textContent(), '');
    assert.equal(await page.locator('#shopName').textContent(), '');
    assert.equal(await page.locator('#notFoundHeading').evaluate(el => el === document.activeElement), true);
  }
  await route('#store/demo-empty', 'catalogueView');
  assert.equal(await page.locator('#emptyState').isVisible(), true);
  assert.equal(await page.locator('#next').isDisabled(), true);
  assert.deepEqual(await ids(), []);
  await page.locator('.samples a').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#results article').length === 6);
});

test('invalid search displays honest error and recovers with safe DOM rendering', async () => {
  await page.locator('#query').fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#catalogueError').isVisible(), true);
  assert.equal(await page.locator('#query').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#next').isDisabled(), true);
  assert.equal(await page.locator('img,script:not([type="module"])').count(), 0);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#catalogueError').isVisible(), false);
  assert.equal(await page.locator('#query').getAttribute('aria-invalid'), 'false');
  assert.equal((await ids()).length, 6);
});

test('language switching preserves authored content, filters, page and shared preference', async () => {
  await page.locator('#sort').selectOption('price-low');
  await page.locator('#next').click();
  const titles = await page.locator('#results h3').allTextContents();
  const storeName = await page.locator('#shopName').textContent();
  for (const locale of ['en', 'hi', 'gu']) {
    await language(locale);
    const catalog = (await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#resultsHeading').textContent(), catalog['store.catalogue']);
    assert.deepEqual(await page.locator('#results h3').allTextContents(), titles);
    assert.equal(await page.locator('#shopName').textContent(), storeName);
    assert.equal(await page.locator('#sort').inputValue(), 'price-low');
  }
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['oldx.preview.locale.v1']);
  await language('hi');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'hi');
  await page.locator('.bar a[href="./service-preview.html"]').last().click();
  await page.waitForFunction(() => document.documentElement.lang === 'hi' && document.querySelector('#browseView'));
});

test('all locales support 320px, actual doubled text, labels and keyboard recovery across views', async () => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const locale of ['gu', 'hi', 'en']) {
    await language(locale);
    for (const [hash, view] of [['#store/demo-shop','catalogueView'], ['#store/demo-shop/product/sample-1','productView'], ['#store/demo-empty','catalogueView'], ['#store/missing','notFoundView']]) {
      // Reload between scales so every view starts at its authored font size.
      await page.goto(origin + '/store-preview.html' + hash);
      await page.reload(); // Fragment-only goto preserves the document and previous inline scale.
      await page.waitForFunction(id => document.documentElement.lang && !document.getElementById(id).hidden && document.querySelector('#localeStatus').textContent.length > 0, view);
      for (const doubled of [false, true]) {
        if (doubled) await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('body *')];
          const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
          nodes.forEach((node, i) => { node.style.fontSize = sizes[i] * 2 + 'px'; });
        });
        const issues = await page.evaluate(() => {
          const visible = node => node.getClientRects().length > 0;
          return {
            width: document.documentElement.scrollWidth, viewport: innerWidth,
            overflow: [...document.querySelectorAll('body *')].filter(visible).filter(node => node.getBoundingClientRect().right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 2).map(node => ({node: node.id || node.tagName, width: node.clientWidth, scroll: node.scrollWidth, font: getComputedStyle(node).fontSize, wrap: getComputedStyle(node).overflowWrap, text: node.textContent.slice(0,45)})).slice(0, 20),
            unlabelled: [...document.querySelectorAll('input,select')].filter(visible).filter(node => !node.labels?.length).map(node => node.id),
            smallButtons: [...document.querySelectorAll('button')].filter(visible).filter(node => node.getBoundingClientRect().height < 44).map(node => node.id)
          };
        });
        assert.ok(issues.width <= issues.viewport + 1, `${locale}/${view}/${doubled}: ${JSON.stringify(issues)}`);
        assert.deepEqual(issues.unlabelled, []);
        assert.deepEqual(issues.smallButtons, []);
      }
    }
  }
  await route('#store/demo-shop', 'catalogueView');
  await page.locator('#query').focus(); await page.keyboard.type('not found');
  await page.locator('#reset').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#query').evaluate(el => el === document.activeElement), true);
});

test('missing locale falls back and unavailable storage does not break discovery', async () => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.route('**/features/i18n/catalogs/hi.mjs', route => route.abort());
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#results article').length === 6);
  await page.locator('#localeSelect').selectOption('hi');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal((await ids()).length, 6);
  assert.match(await page.locator('#localeStatus').textContent(), /could not load/);
});

test('a slow earlier language cannot replace the latest choice or preference', async () => {
  let release, seen;
  const gate = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { seen = resolve; });
  await page.route('**/features/i18n/catalogs/hi.mjs', async route => { seen(); await gate; await route.continue(); });
  await page.locator('#localeSelect').selectOption('hi');
  await requested;
  await language('en');
  const loaded = page.waitForResponse(response => response.url().endsWith('/features/i18n/catalogs/hi.mjs'));
  release(); await loaded;
  await page.waitForTimeout(50); // Let the delayed import's continuation run.
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.evaluate(() => localStorage.getItem('oldx.preview.locale.v1')), 'en');
  assert.equal((await ids()).length, 6);
});

test('keyboard skip link keeps the current catalogue or product route intact', async () => {
  for (const hash of ['#store/demo-shop', '#store/demo-shop/product/sample-1']) {
    await page.goto(origin + '/store-preview.html' + hash);
    await page.waitForFunction(() => document.querySelector('#localeStatus').textContent.length > 0);
    await page.locator('.skip').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main').evaluate(node => document.activeElement === node), true);
    assert.equal(new URL(page.url()).hash, hash);
    assert.equal(await page.locator('#notFoundView').isVisible(), false);
  }
});
