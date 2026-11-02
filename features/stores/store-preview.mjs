import { buildStoreCataloguePage } from './store-catalogue.mjs';
import { sampleStores, sampleListings } from './preview-fixtures.mjs';
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
const categories = ['cars', 'properties', 'mobiles', 'bikes', 'electronics', 'commercial',
  'furniture', 'fashion', 'books', 'pets', 'jobs', 'services'];
for (const category of categories) {
  const option = document.createElement('option');
  option.value = category; option.dataset.i18n = 'store.category.' + category;
  $('category').append(option);
}
let translator = createTranslator('en');
const t = (key, params) => translator.t(key, params);
let localeRequest = 0, page = 1, currentStore = null, renderedHash = null, returnProductId = null;
function storage() { try { return window.localStorage; } catch { return null; } }
function resetFilters() {
  $('query').value = ''; $('category').value = 'all'; $('sort').value = 'newest';
  $('availableOnly').checked = false; page = 1;
}
function catalogue(options = {}) {
  return buildStoreCataloguePage({ storeUid: currentStore.id, listings: sampleListings,
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
function renderRoute(focus = false) {
  const route = parseStorePreviewRoute(window.location.hash);
  const store = sampleStores.find(item => item.id === route.storeId);
  if (currentStore?.id !== store?.id) { resetFilters(); returnProductId = null; }
  currentStore = store ?? null;
  let view = route.view;
  let product = null;
  if (!store) view = 'not-found';
  if (store && view === 'product') {
    const publicPage = catalogue({ query: '', category: 'all', availableOnly: false, page: 1, pageSize: 24 });
    product = publicPage.ok && publicPage.items.find(item => item.id === route.productId);
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
    if (returnProductId) target = [...document.querySelectorAll('#results a')].find(link => link.dataset.productId === returnProductId) ?? target;
  } else if (view === 'product') {
    $('productTitle').textContent = product.title;
    $('productCategory').textContent = t('store.category.' + product.category);
    $('productPrice').textContent = product.priceLabel;
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
  renderedHash = window.location.hash; renderRoute(true);
}
window.addEventListener('hashchange', routeChanged);
window.addEventListener('popstate', routeChanged);
function filtersChanged() { if (!currentStore) return; page = 1; renderCatalogue(); }
$('query').addEventListener('input', filtersChanged);
for (const id of ['category', 'sort', 'availableOnly']) $(id).addEventListener('change', filtersChanged);
$('filters').addEventListener('submit', event => { event.preventDefault(); filtersChanged(); $('resultsHeading').focus(); });
$('reset').addEventListener('click', () => { if (!currentStore) return; resetFilters(); renderCatalogue(); $('query').focus(); });
for (const [id, step] of [['previous', -1], ['next', 1]]) {
  $(id).addEventListener('click', () => { page += step; renderCatalogue(); $('resultsHeading').focus(); });
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
  renderRoute();
}
$('localeSelect').addEventListener('change', event => selectLocale(event.target.value, true));
await selectLocale(readLocalePreference(storage(), 'gu'));
renderedHash = window.location.hash;
