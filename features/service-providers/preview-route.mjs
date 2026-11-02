const PROVIDER_ID = /^[A-Za-z0-9_-]{1,100}$/;

// Deliberately local to the isolated preview. These routes do not implement the
// proposed production /services/provider/:id endpoint or social crawler preview.
export function parseServicePreviewRoute(hash) {
  if (typeof hash !== 'string' || hash.length > 150) return { view: 'not-found' };
  if (hash === '' || hash === '#' || hash === '#services') return { view: 'browse' };
  if (hash === '#my-services') return { view: 'provider' };
  const match = /^#provider\/([A-Za-z0-9_-]{1,100})$/.exec(hash);
  return match ? { view: 'profile', providerId: match[1] } : { view: 'not-found' };
}

export function buildServicePreviewLink({ pageUrl, origin, providerId } = {}) {
  if (typeof providerId !== 'string' || !PROVIDER_ID.test(providerId) ||
      typeof pageUrl !== 'string' || typeof origin !== 'string') {
    return { ok: false, code: 'INVALID_PREVIEW_LINK' };
  }
  try {
    const page = new URL(pageUrl);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(page.hostname);
    if (page.origin !== origin || page.username || page.password ||
        (page.protocol !== 'https:' && !(page.protocol === 'http:' && local)) ||
        !page.pathname.endsWith('/service-preview.html')) {
      return { ok: false, code: 'INVALID_PREVIEW_LINK' };
    }
    // Never forward query tokens, unrelated fragments or private draft state.
    page.search = '';
    page.hash = 'provider/' + providerId;
    if (page.href.length > 2048) return { ok: false, code: 'INVALID_PREVIEW_LINK' };
    return { ok: true, url: page.href };
  } catch { return { ok: false, code: 'INVALID_PREVIEW_LINK' }; }
}
