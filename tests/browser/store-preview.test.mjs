import { readFile } from 'node:fs/promises';
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

// Controlled mock completion, deliberately ignoring AbortSignal to prove the
// revision gate rather than relying on a cooperative adapter or timing sleeps.
async function controlledAdapter() {
  await page.route('**/features/stores/preview-adapter.mjs', request => request.fulfill({ contentType: 'text/javascript', body: `
    import { sampleStores, sampleListings } from './preview-fixtures.mjs';
    window.sampleRequests = [];
    function requestSample(scope, { signal }, detail = false) {
      return new Promise((resolve, reject) => window.sampleRequests.push({scope, signal,
        finish(kind = 'ready') {
          if (kind === 'error') return reject(new Error('PRIVATE MOCK ERROR'));
          if (kind === 'invalid') return resolve({status:'published',store:{},records:['PRIVATE']});
          if (kind === 'revoked') return resolve({status:'revoked'});
          if (detail) {
            const store = sampleStores.find(s=>s.id===scope.storeUid);
            const row = sampleListings.find(r=>r.id===scope.productId);
            return resolve({status:'published',
              store:kind==='store-removed'?null:{...store,sellerUid:store.id,publicationStatus:kind==='store-suspended'?'suspended':kind==='store-unpublished'?'unpublished':'published'},
              listing:kind==='removed'?null:{...row,id:kind==='wrong-id'?'other-product':row?.id,
                sellerUid:kind==='wrong-owner'?'other-seller':row?.sellerUid,publicationStatus:kind==='listing-revoked'?'suspended':'published'}});
          }
          resolve({status:'published',store:{...sampleStores.find(s=>s.id===scope.storeUid),...(kind==='long-name'?{name:'W'.repeat(120)}:{})},
            records:sampleListings.filter(r=>r.sellerUid===scope.storeUid && !(kind==='removed' && r.id===scope.productId)).map((r,i)=>({...r,publicationStatus:kind==='listing-revoked' && i===0?'suspended':'published'}))});
        }
      }));
    }
    export const readSyntheticStore = (scope, options) => requestSample(scope, options);
    export const readSyntheticDetail = (scope, options) => requestSample(scope, options, true);` }));
  await page.reload();
  await page.waitForFunction(() => window.sampleRequests?.length === 1);
}
async function finishRequest(index, kind = 'ready') {
  await page.evaluate(({ index, kind }) => window.sampleRequests[index].finish(kind), { index, kind });
}
async function ready() { await page.waitForFunction(() => document.querySelector('#catalogueView').getAttribute('aria-busy') === 'false' && document.querySelector('#loadStatus').textContent === ''); }

test('rapid category, sort, search and stale pagination accept only the latest mock response', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.locator('#next').click();
  assert.equal(await page.locator('#results article').count(), 0);
  assert.equal(await page.locator('#next').isDisabled(), true);
  await page.locator('#category').selectOption('books');
  await page.locator('#sort').selectOption('price-low');
  await page.locator('#query').fill('ગુજરાતી');
  await page.waitForFunction(() => window.sampleRequests.length === 5);
  assert.equal(await page.evaluate(() => sampleRequests[1].scope.page), 2);
  assert.equal(await page.evaluate(() => sampleRequests[4].scope.page), 1);
  assert.equal(await page.evaluate(() => sampleRequests.slice(1,4).every(r=>r.signal.aborted)), true);
  await finishRequest(4); await ready();
  assert.deepEqual(await ids(), ['sample-13']);
  for (const [index,kind] of [[1,'invalid'],[3,'ready'],[2,'revoked']]) await finishRequest(index,kind);
  assert.deepEqual(await ids(), ['sample-13']);
  assert.equal(await page.locator('#query').evaluate(node=>node===document.activeElement), true);
});

test('withdrawn products and pending details stay cleared through history and late completion', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.locator('#results a').first().click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  assert.equal(await page.locator('#productTitle').textContent(), '');
  await finishRequest(1);
  await page.waitForFunction(()=>document.querySelector('#productTitle').textContent.length>0);
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===3);
  assert.equal(await page.locator('#productTitle').textContent(), '');
  await page.locator('#responseMode').selectOption('revoked');
  assert.equal(await page.locator('#loadError').isVisible(), true);
  await finishRequest(2);
  assert.equal(await page.locator('#productTitle').textContent(), '');
  assert.equal(await page.locator('#shopName').textContent(), '');
  await page.goBack(); await page.goForward();
  assert.equal(await page.locator('#productTitle').textContent(), '');
  assert.equal(await page.locator('#results article').count(), 0);
  assert.equal(await page.evaluate(()=>sampleRequests.length), 3);
});

test('invalid response and read failure have safe recovery without stale data or focus theft', async () => {
  await controlledAdapter(); await finishRequest(0, 'invalid'); await ready();
  assert.equal(await page.locator('#loadError').isVisible(), true);
  assert.equal(await page.locator('#results article').count(), 0);
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  await finishRequest(1, 'error'); await ready();
  assert.equal(await page.locator('#loadError').evaluate(node=>node===document.activeElement), true);
  assert.equal((await page.locator('body').textContent()).includes('PRIVATE'), false);
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===3);
  await page.locator('#query').focus();
  await finishRequest(2); await ready();
  assert.equal(await page.locator('#query').evaluate(node=>node===document.activeElement), true);
  assert.equal(await page.locator('#results article').count(), 6);
});

test('pending/error/revoked states localize at 320px with 200 percent text without another read', async () => {
  await controlledAdapter();
  await page.setViewportSize({ width: 320, height: 900 });
  for (const locale of ['gu','hi','en']) {
    await language(locale);
    const catalog = (await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#loadStatus').textContent(), catalog['store.loading']);
    assert.equal(await page.evaluate(()=>sampleRequests.length), 1);
    await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('body *')];
      const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
      nodes.forEach((n,i)=>{n.style.fontSize=sizes[i]*2+'px';});
    });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), true);
    assert.equal(await page.locator('#responseMode').evaluate(node=>node.labels.length>0), true);
    await page.evaluate(()=>document.querySelectorAll('body *').forEach(n=>n.style.removeProperty('font-size')));
  }
  await finishRequest(0,'revoked'); await ready();
  for (const locale of ['gu','hi','en']) {
    await language(locale);
    const catalog = (await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#loadError').textContent(), catalog['store.revoked']);
    await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('body *')];
      const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
      nodes.forEach((n,i)=>{n.style.fontSize=sizes[i]*2+'px';});
    });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), true);
    await page.evaluate(()=>document.querySelectorAll('body *').forEach(n=>n.style.removeProperty('font-size')));
  }
});

test('changing to an invalid route discards pending product data and late errors', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.locator('#results a').first().click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  await page.evaluate(()=>{location.hash='#store/missing';});
  await page.waitForFunction(()=>!document.querySelector('#notFoundView').hidden);
  await finishRequest(1);
  assert.equal(await page.locator('#productTitle').textContent(), '');
  assert.equal(await page.locator('#shopName').textContent(), '');
  assert.equal(await page.locator('#results article').count(), 0);
  assert.equal(await page.locator('#notFoundHeading').evaluate(node=>node===document.activeElement), true);
  assert.equal(await page.locator('#loadError').isVisible(), false);
});

test('visible offline simulation controls delay, fail, withdraw and recover without remote requests', async () => {
  await page.locator('#responseMode').selectOption('delayed');
  assert.equal(await page.locator('#catalogueView').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#results article').count(), 0);
  await page.locator('#category').selectOption('books');
  await page.waitForFunction(()=>document.querySelectorAll('#results article').length===3);
  assert.equal(await page.locator('#catalogueView').getAttribute('aria-busy'), 'false');
  for (const scenario of ['error','invalid','revoked']) {
    await page.locator('#responseMode').selectOption(scenario);
    await page.waitForFunction(()=>!document.querySelector('#loadError').hidden);
    assert.equal(await page.locator('#results article').count(), 0);
    assert.equal(await page.locator('#shopName').textContent(), '');
  }
  await page.locator('#responseMode').selectOption('normal');
  await page.waitForFunction(()=>document.querySelectorAll('#results article').length===3);
  assert.equal(await page.locator('#loadError').isVisible(), false);
});

test('withdrawn listing payloads fail closed and removed product detail recovers without stale fields', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.locator('#results a').first().click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  await finishRequest(1);
  await page.waitForFunction(()=>document.querySelector('#productTitle').textContent.length>0);
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===3);
  await finishRequest(2,'listing-revoked'); await ready();
  assert.equal(await page.locator('#notFoundView').isVisible(), true);
  assert.equal(await page.locator('#productTitle').textContent(), '');
  assert.equal(await page.locator('#productPrice').textContent(), '');
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===4);
  await finishRequest(3,'removed');
  await page.waitForFunction(()=>!document.querySelector('#notFoundView').hidden);
  assert.equal(await page.locator('#productTitle').textContent(), '');
  assert.equal(await page.locator('#backToCatalogue').getAttribute('href'), null);
  assert.equal(await page.locator('#notFoundHeading').evaluate(node=>node===document.activeElement), true);
});

test('a stalled mock times out with accessible recovery and cannot restore late product data', async () => {
  await page.clock.install();
  await controlledAdapter();
  await page.clock.fastForward(5001);
  await page.waitForFunction(()=>!document.querySelector('#loadError').hidden);
  assert.equal(await page.locator('#catalogueView').getAttribute('aria-busy'), 'false');
  assert.equal(await page.locator('#results article').count(), 0);
  await finishRequest(0);
  assert.equal(await page.locator('#results article').count(), 0);
  await page.locator('#retryRead').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>sampleRequests.length===2);
  await finishRequest(1); await ready();
  assert.equal(await page.locator('#results article').count(), 6);
  assert.equal(await page.locator('#resultsHeading').evaluate(node=>node===document.activeElement), true);
});

test('document cache lifecycle clears pending data and requires a fresh mock read on restore', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal(await page.locator('#results article').count(), 0);
  await finishRequest(1);
  assert.equal(await page.locator('#results article').count(), 0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>sampleRequests.length===3);
  assert.equal(await page.locator('#results article').count(), 0);
  await finishRequest(2); await ready();
  assert.equal(await page.locator('#results article').count(), 6);
});

test('independent detail publication checks clear a previously listed product in every mobile locale', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.setViewportSize({width:320,height:900});
  await page.locator('#results a').first().click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  assert.equal(await page.evaluate(()=>sampleRequests[1].scope.view), 'product');
  await finishRequest(1,'store-suspended'); await ready();
  assert.equal(await page.locator('#productTitle').textContent(),'');
  assert.equal(await page.locator('#shopName').textContent(),'');
  assert.equal(await page.locator('#notFoundHeading').evaluate(n=>n===document.activeElement),true);
  for(const locale of ['gu','hi','en']) {
    await language(locale);
    const catalog=(await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#notFoundHeading').textContent(),catalog['store.detailUnavailable']);
    assert.equal(await page.locator('#notFoundDescription').textContent(),catalog['store.detailUnavailableText']);
    await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('body *')], sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
      nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');
    });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.evaluate(()=>document.querySelectorAll('body *').forEach(n=>n.style.removeProperty('font-size')));
    assert.equal(await page.evaluate(()=>sampleRequests.length),2,'locale does not repeat publication reads');
  }
});

test('out-of-order direct details and history never reuse another product or its publication claim', async () => {
  await controlledAdapter(); await finishRequest(0); await ready();
  await page.evaluate(()=>{location.hash='#store/demo-shop/product/sample-1';});
  await page.waitForFunction(()=>sampleRequests.length===2);
  await page.evaluate(()=>{location.hash='#store/demo-shop/product/sample-2';});
  await page.waitForFunction(()=>sampleRequests.length===3);
  await finishRequest(2);
  await page.waitForFunction(()=>document.querySelector('#productTitle').textContent.length>0);
  const title=await page.locator('#productTitle').textContent();
  await finishRequest(1,'wrong-id');
  assert.equal(await page.locator('#productTitle').textContent(),title);
  assert.equal(await page.locator('#loadError').isVisible(),false);
  await page.goBack();
  await page.waitForFunction(()=>sampleRequests.length===4);
  assert.equal(await page.locator('#productTitle').textContent(),'');
  await finishRequest(3,'store-unpublished'); await ready();
  assert.equal(await page.locator('#notFoundView').isVisible(),true);
  await page.goForward();
  await page.waitForFunction(()=>sampleRequests.length===5);
  await finishRequest(4);
  await page.waitForFunction(()=>document.querySelector('#productTitle').textContent.length>0);
  assert.equal(await page.locator('#productTitle').textContent(),title);
  assert.equal(await page.locator('#productTitle').evaluate(n=>n===document.activeElement),true);
});

test('detail timeout, identity mismatch and retry never fall back to accepted catalogue content', async () => {
  await page.clock.install(); await controlledAdapter(); await finishRequest(0); await ready();
  await page.locator('#results a').first().click();
  await page.waitForFunction(()=>sampleRequests.length===2);
  await page.clock.fastForward(5001);
  await page.waitForFunction(()=>!document.querySelector('#loadError').hidden);
  assert.equal(await page.locator('#productTitle').textContent(),'');
  await finishRequest(1);
  assert.equal(await page.locator('#productTitle').textContent(),'');
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===3);
  await finishRequest(2,'wrong-owner'); await ready();
  assert.equal(await page.locator('#loadError').isVisible(),true);
  assert.equal(await page.locator('#productPrice').textContent(),'');
  await page.locator('#retryRead').click();
  await page.waitForFunction(()=>sampleRequests.length===4);
  await finishRequest(3);
  await page.waitForFunction(()=>document.querySelector('#productTitle').textContent.length>0);
  assert.equal(await page.locator('#productTitle').evaluate(n=>n===document.activeElement),true);
});

test('Store copy uses a canonical sample link without query tokens, product IDs or filters', async () => {
  await page.goto(origin+'/store-preview.html?token=PRIVATE#store/demo-shop/product/sample-1');
  await page.waitForFunction(()=>document.querySelector('#productTitle').textContent.length>0);
  await page.evaluate(()=>{
    window.storeCopies=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>storeCopies.push(value)}});
  });
  await page.locator('#copyStoreLink').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>storeCopies.length===1 && !document.querySelector('#copyStoreLink').disabled);
  assert.deepEqual(await page.evaluate(()=>storeCopies),[origin+'/store-preview.html#store/demo-shop']);
  assert.equal(await page.locator('#storeShareLink').inputValue(),origin+'/store-preview.html#store/demo-shop');
  assert.equal((await page.locator('#storeShareStatus').textContent()).includes('PRIVATE'),false);
});

test('Store native sharing cancellation and clipboard denial have honest localized recovery', async () => {
  const name=await page.locator('#shopName').textContent();
  await page.evaluate(()=>{
    window.storeCopies=[]; window.sharedData=[];
    Object.defineProperty(navigator,'share',{configurable:true,value:async value=>{sharedData.push(value);throw new DOMException('Cancelled','AbortError');}});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>storeCopies.push(value)}});
  });
  await language('en'); await page.locator('#shareStoreLink').click();
  await page.waitForFunction(()=>!document.querySelector('#shareStoreLink').disabled);
  assert.deepEqual(await page.evaluate(()=>storeCopies),[]);
  assert.equal(await page.evaluate(()=>sharedData[0].url),origin+'/store-preview.html#store/demo-shop');
  assert.equal(await page.evaluate(()=>sharedData[0].title),'OldX Store preview · '+name);
  assert.match(await page.evaluate(()=>sharedData[0].text),/Demo only/);
  const english=(await import('../../features/i18n/catalogs/en.mjs')).default;
  assert.equal(await page.locator('#storeShareStatus').textContent(),english.previewShareCancelled);
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  for(const locale of ['gu','hi','en']) {
    await language(locale); await page.locator('#copyStoreLink').click();
    await page.waitForFunction(()=>!document.querySelector('#copyStoreLink').disabled);
    const catalog=(await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#storeShareStatus').textContent(),catalog.previewShareUnavailable);
    assert.equal(await page.locator('#shopName').textContent(),name);
    assert.equal(await page.locator('#storeShareLink').inputValue(),origin+'/store-preview.html#store/demo-shop');
    assert.equal(await page.locator('#storeShareLink').evaluate(n=>n.readOnly && n.labels.length>0),true);
  }
});

test('Store sharing is disabled during loading/withdrawal and late copy feedback cannot revive it', async () => {
  await controlledAdapter();
  assert.equal(await page.locator('#copyStoreLink').isDisabled(),true);
  assert.equal(await page.locator('#storeShareLink').inputValue(),'');
  await finishRequest(0); await ready();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(resolve=>{window.finishStoreCopy=resolve;})}}));
  await page.locator('#copyStoreLink').click();
  await page.waitForFunction(()=>typeof finishStoreCopy==='function');
  await page.locator('#responseMode').selectOption('revoked');
  assert.equal(await page.locator('#storeShareLink').inputValue(),'');
  await page.evaluate(()=>finishStoreCopy());
  assert.equal(await page.locator('#storeShareStatus').textContent(),'');
  assert.equal(await page.locator('#copyStoreLink').isDisabled(),true);
  await page.locator('#responseMode').selectOption('normal');
  await page.waitForFunction(()=>sampleRequests.length===2);
  assert.equal(await page.locator('#shareStoreLink').isDisabled(),true);
  await finishRequest(1); await ready();
  assert.equal(await page.locator('#shareStoreLink').isEnabled(),true);
  assert.equal(await page.locator('#storeShareStatus').textContent(),'');
});

test('sample card exports a safe local SVG in every language with public sample fields only', async()=>{
  const name=await page.locator('#shopName').textContent();
  for(const locale of ['gu','hi','en']){
    await language(locale);
    const catalog=(await import(`../../features/i18n/catalogs/${locale}.mjs`)).default;
    assert.equal(await page.locator('#cardBadge').textContent(),catalog['store.cardBadge']);
    assert.equal(await page.locator('#cardName').textContent(),name);
    const event=page.waitForEvent('download');await page.locator('#exportStoreCard').focus();await page.keyboard.press('Enter');
    const download=await event;
    assert.equal(download.suggestedFilename(),'oldx-sample-store-demo-shop.svg');
    const svg=await readFile(await download.path(),'utf8');
    const facts=await page.evaluate(svg=>{
      const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
      return {error:!!doc.querySelector('parsererror'),unsafe:doc.querySelectorAll('script,image,foreignObject,a').length,text:doc.documentElement.textContent};
    },svg);
    assert.equal(facts.error,false);assert.equal(facts.unsafe,0);
    assert.ok(facts.text.includes(name));assert.ok(facts.text.includes(catalog['store.cardBadge']));
    assert.ok(svg.includes(origin+'/store-preview.html#store/demo-shop'));
    assert.ok(svg.length<32768);
  }
});

test('card cancel, denied export and withdrawal cannot trigger a stale image download', async()=>{
  await page.evaluate(()=>{
    window.cardDownloads=0;
    Object.defineProperty(document.fonts,'ready',{configurable:true,get:()=>new Promise(resolve=>{window.releaseCardFonts=resolve;})});
    URL.createObjectURL=()=>{cardDownloads++;throw new Error('PRIVATE DENIAL');};
  });
  await page.locator('#exportStoreCard').click();
  await page.waitForFunction(()=>typeof releaseCardFonts==='function');
  await page.locator('#cancelStoreCard').click();
  await page.evaluate(()=>releaseCardFonts());
  assert.equal(await page.evaluate(()=>cardDownloads),0);
  assert.equal(await page.locator('#exportStoreCard').evaluate(n=>n===document.activeElement),true);
  await page.locator('#exportStoreCard').click();
  await page.evaluate(()=>releaseCardFonts());
  await page.waitForFunction(()=>!document.querySelector('#exportStoreCard').disabled);
  assert.equal(await page.evaluate(()=>cardDownloads),1);
  const gu=(await import('../../features/i18n/catalogs/gu.mjs')).default;
  assert.equal(await page.locator('#storeCardStatus').textContent(),gu['store.cardDenied']);
  assert.equal((await page.locator('#storeCardStatus').textContent()).includes('PRIVATE'),false);
  await page.locator('#exportStoreCard').click();
  await page.locator('#responseMode').selectOption('revoked');
  await page.evaluate(()=>releaseCardFonts());
  assert.equal(await page.locator('#cardName').textContent(),'');
  assert.equal(await page.locator('#storeCardPreview').isVisible(),false);
  assert.equal(await page.locator('#exportStoreCard').isDisabled(),true);
  assert.equal(await page.evaluate(()=>cardDownloads),1);
});

test('long authored card names stay complete at 320px and doubled text',async()=>{
  await controlledAdapter();await finishRequest(0,'long-name');await ready();
  await page.setViewportSize({width:320,height:900});
  assert.equal(await page.locator('#cardName').textContent(),'W'.repeat(120));
  await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('body *')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
    nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');
  });
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.locator('#cardName').textContent(),'W'.repeat(120));
});
