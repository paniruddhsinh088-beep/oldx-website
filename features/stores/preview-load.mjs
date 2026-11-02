import { buildStoreCataloguePage } from './store-catalogue.mjs';

const plain = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const text = (value, max, required = true) => typeof value === 'string' && value.length <= max &&
  (!required || value.trim().length > 0) && !/[<>\u0000-\u001f\u007f-\u009f]/u.test(value);

// Synthetic snapshot boundary only, not publication authorization or a real
// adapter. Never deliver legacy/private documents to a browser for redaction.
export function projectPreviewSnapshot(input, storeUid) {
  if (!plain(input)) return null;
  if (input.status === 'revoked') return { status: 'revoked' };
  if (input.status !== 'published' || !plain(input.store) || input.store.id !== storeUid ||
      !text(input.store.name, 120) || !text(input.store.city, 120) ||
      !text(input.store.description, 1200, false) || !Array.isArray(input.records) || input.records.length > 100) return null;
  const page = buildStoreCataloguePage({ storeUid, listings: input.records, pageSize: 24 });
  if (!page.ok || page.skippedCount || page.matchedCount !== input.records.length) return null;
  if (Array.from(input.records).some(row => !plain(row) || row.publicationStatus !== 'published' || !plain(row.createdAt) ||
      !Number.isSafeInteger(row.createdAt.seconds) || row.createdAt.seconds < 0 || row.createdAt.seconds > 253402300799 ||
      !Number.isInteger(row.createdAt.nanoseconds) || row.createdAt.nanoseconds < 0 || row.createdAt.nanoseconds >= 1e9)) return null;
  // Explicit public synthetic fields only. Deep copies prevent late mutation of
  // a resolved mock response from changing an accepted snapshot.
  return Object.freeze({ status: 'ready', store: Object.freeze({ id: storeUid,
    name: input.store.name, city: input.store.city, description: input.store.description }),
    records: Object.freeze(input.records.map(row => Object.freeze({ id: row.id, sellerUid: storeUid,
      title: row.title.normalize('NFC').trim(), category: row.category, basePrice: row.basePrice,
      isSold: row.isSold, createdAt: Object.freeze({ seconds: row.createdAt.seconds, nanoseconds: row.createdAt.nanoseconds }) }))) });
}

export function createStoreLoadController({ read, onChange,
  project = (response, request) => projectPreviewSnapshot(response, request.storeUid), timeoutMs = 5000,
  schedule = setTimeout, cancel = clearTimeout }) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new TypeError('Invalid preview deadline');
  let revision = 0, pending = null, timer = null;
  const emit = state => onChange(Object.freeze(state));
  function stopTimer() { if (timer !== null) cancel(timer); timer = null; }
  function invalidate() { revision++; stopTimer(); pending?.abort(); pending = null; }
  return Object.freeze({
    async load(scope) {
      invalidate();
      const version = revision;
      const controller = new AbortController(); pending = controller;
      const request = Object.freeze({ ...scope });
      emit({ status: 'loading' });
      let timedOut = false;
      try {
        const deadline = new Promise((resolve, reject) => {
          timer = schedule(() => {
            timedOut = true;
            controller.abort();
            reject(new Error('Preview deadline'));
          }, timeoutMs);
        });
        const response = await Promise.race([read(request, { signal: controller.signal }), deadline]);
        if (version !== revision) return;
        const snapshot = project(response, request);
        emit(snapshot ? { status: snapshot.status, snapshot: snapshot.status === 'ready' ? snapshot : null }
          : { status: 'error', code: 'INVALID_PREVIEW_RESPONSE' });
      } catch {
        if (version === revision) emit({ status: 'error', code: timedOut ? 'PREVIEW_READ_TIMEOUT' : 'PREVIEW_READ_FAILED' });
      } finally { if (version === revision) { stopTimer(); pending = null; } }
    },
    clear() { invalidate(); emit({ status: 'idle' }); },
    revoke() { invalidate(); emit({ status: 'revoked' }); }
  });
}
