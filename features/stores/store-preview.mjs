import { buildStorePreviewLink } from './preview-share.mjs';
import { shareProviderLink } from '../service-providers/provider-mobile-share.mjs';
import { buildStoreCataloguePage, STORE_CATEGORY_IDS } from './store-catalogue.mjs';
import { sampleStores } from './preview-fixtures.mjs';
import { projectSyntheticDetail } from './preview-detail.mjs';
import { createStoreLoadController, projectPreviewSnapshot } from './preview-load.mjs';
import { readSyntheticStore, readSyntheticDetail } from './preview-adapter.mjs';
import { parseStorePreviewRoute } from './preview-route.mjs';
import { createTranslator, loadTranslator, SUPPORTED_LOCALES } from '../i18n/i18n.mjs';
import { applyCatalog } from '../i18n/dom.mjs';
import { readLocalePreference, writeLocalePreference } from '../i18n/preference.mjs';

const $ = id => document.getElementById(id);
// In-page focus must not replace the fragment used by the sample router.
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  $('main').focus();
  $('main').scrollIntoView({ block: 'start', behavior: 'instant' });
});
for (const category of STORE_CATEGORY_IDS) {
  const option = document.createElement('option');
  option.value = category; option.dataset.i18n = 'store.category.' + category;
  $('category').append(option);
}
let translator = createTranslator('en');
const t = (key, params) => translator.t(key, params);
let activeRecords = [], snapshot = null, selectedStoreId = null;
let shareRevision = 0, sharePending = false, shareFeedback = null;
let loadState = { status: 'idle' }, focusAfterLoad = false, restoreAfterLoad = false;
let localeRequest = 0, page = 1, currentStore = null, renderedHash = null, returnProductId = null;
function storage() { try { return window.localStorage; } catch { return null; } }
function resetFilters() {
  $('query').value = ''; $('category').value = 'all'; $('sort').value = 'newest';
  $('availableOnly').checked = false; page = 1;
}
function catalogue(options = {}) {
  return buildStoreCataloguePage({ storeUid: currentStore.id, listings: activeRecords,
    locale: translator.locale, query: $('query').value, category: $('category').value,
    sort: $('sort').value, availableOnly: $('availableOnly').checked, page, pageSize: 6, ...options });
}
function textNode(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderCatalogue() {
  const result = catalogue();
  $('results').replaceChildren(); $('catalogueError').hidden = result.ok;
  $('emptyState').hidden = true;
  $('previous').disabled = !result.ok || page <= 1;
  $('next').disabled = !result.ok || !result.hasMoreInBatch;
  $('query').setAttribute('aria-invalid', String(!result.ok));
  if (!result.ok) {
    $('catalogueError').textContent = t('store.error');
    $('resultCount').textContent = ''; $('pageStatus').textContent = '';
    return;
  }
  $('catalogueError').textContent = '';
  $('resultCount').textContent = t('store.resultCount', { count: result.matchedCount });
  $('pageStatus').textContent = t('store.pageStatus', { page, total: Math.max(1, Math.ceil(result.matchedCount / 6)) });
  if (!result.items.length) {
    $('emptyState').hidden = false;
    $('emptyState').textContent = t(currentStore.id === 'demo-empty' ? 'store.emptyShopText' : 'store.emptyResults');
  }
  for (const product of result.items) {
    const card = document.createElement('article'); card.className = 'card'; card.dataset.productId = product.id;
    const heading = textNode('h3', product.title);
    const category = textNode('p', t('store.category.' + product.category), 'muted');
    const price = textNode('p', product.priceLabel, 'price');
    const availability = textNode('p', t(product.available ? 'store.available' : 'store.sold'), 'availability');
    const link = textNode('a', t('store.viewProduct', { title: product.title }));
    link.href = '#store/' + currentStore.id + '/product/' + product.id;
    link.dataset.productId = product.id;
    card.append(heading, category, price, availability, link); $('results').append(card);
  }
}
function displayRoute(focus = false, restoreResult = false) {
  const route = parseStorePreviewRoute(window.location.hash);
  const store = snapshot?.store.id === route.storeId ? snapshot.store : null;
  currentStore = store ?? null;
  let view = route.view;
  let product = null;
  if (!store) view = 'not-found';
  if (store && view === 'product') {
    product = snapshot?.product?.id === route.productId ? snapshot.product : null;
    if (!product) view = 'not-found';
  }
  for (const link of document.querySelectorAll('.samples a')) {
    link.setAttribute('aria-current', store && view !== 'not-found' && link.hash === '#store/' + store.id ? 'page' : 'false');
  }
  $('shopHeader').hidden = !store || view === 'not-found';
  $('shopName').textContent = store && view !== 'not-found' ? store.name : '';
  $('shopCity').textContent = store && view !== 'not-found' ? store.city : '';
  $('shopDescription').textContent = store && view !== 'not-found' ? store.description : '';
  for (const [id, active] of [['catalogueView', 'catalogue'], ['productView', 'product'], ['notFoundView', 'not-found']]) {
    $(id).hidden = view !== active;
  }
  // Never leave a previous product in the recovery view or hidden share state.
  for (const id of ['productTitle', 'productCategory', 'productPrice', 'productAvailability']) $(id).textContent = '';
  let target = $('notFoundHeading');
  if (view === 'catalogue') {
    renderCatalogue(); target = $('resultsHeading');
    if (restoreResult && returnProductId) target = [...document.querySelectorAll('#results a')].find(link => link.dataset.productId === returnProductId) ?? target;
  } else if (view === 'product') {
    $('productTitle').textContent = product.title;
    $('productCategory').textContent = t('store.category.' + product.category);
    $('productPrice').textContent = '₹' + translator.number(product.price, { maximumFractionDigits: 0 });
    $('productAvailability').textContent = t(product.available ? 'store.available' : 'store.sold');
    $('backToCatalogue').href = '#store/' + store.id;
    returnProductId = product.id; target = $('productTitle');
  } else {
    $('results').replaceChildren(); $('resultCount').textContent = ''; $('pageStatus').textContent = '';
    $('backToCatalogue').removeAttribute('href');
  }
  if (focus) { target.focus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
function routeChanged() {
  if (renderedHash === window.location.hash) return;
  const restore = renderedHash?.includes('/product/');
  renderedHash = window.location.hash; requestRoute(true, restore);
}
window.addEventListener('hashchange', routeChanged);
window.addEventListener('popstate', routeChanged);
function filtersChanged() { if (!selectedStoreId) return; page = 1; requestRoute(); }
$('query').addEventListener('input', filtersChanged);
for (const id of ['category', 'sort', 'availableOnly']) $(id).addEventListener('change', filtersChanged);
$('filters').addEventListener('submit', event => { event.preventDefault(); filtersChanged(); $('resultsHeading').focus(); });
$('reset').addEventListener('click', () => { if (!selectedStoreId) return; resetFilters(); requestRoute(); $('query').focus(); });
for (const [id, step] of [['previous', -1], ['next', 1]]) {
  $(id).addEventListener('click', () => { page += step; requestRoute(true); });
}
async function selectLocale(requested, persist = false) {
  const request = ++localeRequest;
  let next, failed = false;
  try { next = await loadTranslator(requested); }
  catch { next = createTranslator('en'); failed = true; }
  if (request !== localeRequest) return;
  translator = next; applyCatalog(document, translator);
  $('localeSelect').value = translator.locale;
  $('localeStatus').textContent = failed ? t('languageUnavailable') : t('languageChanged', {
    language: SUPPORTED_LOCALES.find(locale => locale.code === translator.locale).name });
  if (persist && !failed) writeLocalePreference(storage(), translator.locale);
  renderLoadState();
}
$('localeSelect').addEventListener('change', event => selectLocale(event.target.value, true));
const loader = createStoreLoadController({
  read: (scope, options) => scope.view === 'product' ? readSyntheticDetail(scope, options) : readSyntheticStore(scope, options),
  project: (response, scope) => scope.view === 'product'
    ? projectSyntheticDetail(response, { storeUid: scope.storeUid, productId: scope.productId })
    : projectPreviewSnapshot(response, scope.storeUid),
  onChange(state) {
  shareRevision++; sharePending = false; shareFeedback = null;
  loadState = state;
  snapshot = state.snapshot ?? null; activeRecords = snapshot?.records ?? [];
  renderLoadState();
} });
function clearDisplayedData() {
  currentStore = null;
  for (const id of ['shopName', 'shopCity', 'shopDescription', 'productTitle', 'productCategory', 'productPrice', 'productAvailability', 'resultCount', 'pageStatus']) $(id).textContent = '';
  $('results').replaceChildren(); $('shopHeader').hidden = true;
  document.querySelectorAll('.samples a').forEach(link => link.setAttribute('aria-current', 'false'));
  $('backToCatalogue').removeAttribute('href');
  $('previous').disabled = $('next').disabled = true;
  $('catalogueError').hidden = $('emptyState').hidden = true;
}
function renderLoadState() {
  const busy = loadState.status === 'loading';
  $('catalogueView').setAttribute('aria-busy', String(busy));
  $('productView').setAttribute('aria-busy', String(busy));
  $('loadStatus').textContent = busy ? t('store.loading') : '';
  const unavailable = loadState.status === 'unavailable';
  $('notFoundHeading').textContent = t(unavailable ? 'store.detailUnavailable' : 'store.notFound');
  $('notFoundDescription').textContent = t(unavailable ? 'store.detailUnavailableText' : 'store.notFoundText');
  const failed = ['error', 'revoked'].includes(loadState.status);
  $('loadError').hidden = !failed;
  $('loadError').textContent = failed ? t(loadState.status === 'revoked' ? 'store.revoked' : 'store.readError') : '';
  if (loadState.status === 'ready') {
    const moveFocus = focusAfterLoad && [$('loadStatus'), $('resultsHeading')].includes(document.activeElement);
    displayRoute(moveFocus, restoreAfterLoad); focusAfterLoad = false;
  } else {
    clearDisplayedData();
    const route = parseStorePreviewRoute(window.location.hash);
    for (const [id, visible] of [['catalogueView', route.view === 'catalogue'], ['productView', route.view === 'product'], ['notFoundView', route.view === 'not-found' || loadState.status === 'idle']]) $(id).hidden = !visible;
    if (loadState.status === 'idle' || unavailable) { $('catalogueView').hidden = $('productView').hidden = true; $('notFoundView').hidden = false; }
    if (unavailable && focusAfterLoad && document.activeElement === $('loadStatus')) { $('notFoundHeading').focus(); focusAfterLoad = false; }
    if (failed && focusAfterLoad && [$('loadStatus'), $('resultsHeading')].includes(document.activeElement)) { $('loadError').focus(); focusAfterLoad = false; }
  }
  renderStoreShare();
}
function requestRoute(focus = false, restoreResult = false) {
  const route = parseStorePreviewRoute(window.location.hash);
  const known = sampleStores.some(store => store.id === route.storeId);
  if (selectedStoreId !== route.storeId) { resetFilters(); returnProductId = null; }
  selectedStoreId = known ? route.storeId : null;
  focusAfterLoad = focus; restoreAfterLoad = restoreResult;
  if (!known) { loader.clear(); if (focus) $('notFoundHeading').focus(); return; }
  if ($('responseMode').value === 'revoked') { loader.revoke(); if (focus) $('loadError').focus(); return; }
  void loader.load({ storeUid: route.storeId, view: route.view, productId: route.productId,
    query: $('query').value, category: $('category').value, sort: $('sort').value,
    availableOnly: $('availableOnly').checked, page, scenario: $('responseMode').value });
  // Keyboard navigation announces loading, then moves to the accepted view only
  // if the user has not moved focus elsewhere while the response was pending.
  if (focus) {
    if (route.view === 'catalogue') { $('resultsHeading').focus(); }
    else $('loadStatus').focus();
  }
}
// Back/forward cache restores must re-read, never revive a cached publication
// claim or let an old pending read complete into the restored document.
window.addEventListener('pagehide', () => loader.clear());
window.addEventListener('pageshow', event => { if (event.persisted) requestRoute(); });
$('responseMode').addEventListener('change', () => requestRoute());
$('retryRead').addEventListener('click', () => requestRoute(true));


function renderStoreShare() {
  const link = loadState.status === 'ready' && snapshot?.store && !$('shopHeader').hidden
    ? buildStorePreviewLink({ pageUrl: window.location.href, origin: window.location.origin, storeUid: snapshot.store.id }) : null;
  $('storeShareLink').value = link?.ok ? link.url : '';
  $('copyStoreLink').disabled = $('shareStoreLink').disabled = !link?.ok || sharePending;
  $('storeShareStatus').textContent = link?.ok
    ? (sharePending ? t('previewSharePending') : shareFeedback ? t(shareFeedback) : '') : '';
}
async function shareStorePreview(copyOnly) {
  if (loadState.status !== 'ready' || !snapshot?.store || !$('storeShareLink').value || sharePending) return;
  const revision = shareRevision;
  const data = {title:t('store.shareTitle',{name:snapshot.store.name}), text:t('store.shareText'), url:$('storeShareLink').value};
  sharePending = true; renderStoreShare();
  const result = await shareProviderLink(data, {
    share: !copyOnly && typeof navigator.share === 'function' ? value => navigator.share(value) : undefined,
    writeText: navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ? value => navigator.clipboard.writeText(value) : undefined
  });
  if (revision !== shareRevision) return;
  sharePending = false;
  shareFeedback = result.ok ? (result.method === 'clipboard' ? 'previewLinkCopied' : 'previewShareOpened')
    : result.code === 'SHARE_CANCELLED' ? 'previewShareCancelled' : 'previewShareUnavailable';
  renderStoreShare();
}
$('copyStoreLink').addEventListener('click', () => shareStorePreview(true));
$('shareStoreLink').addEventListener('click', () => shareStorePreview(false));

await selectLocale(readLocalePreference(storage(), 'gu'));
requestRoute();
renderedHash = window.location.hash;
