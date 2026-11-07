// Inactive UI-to-transport boundary. No endpoint, credentials, SDK or persistence.
// The injected send port must provide authentication and server-side enforcement.
const operations = new Set(['draft.save', 'publication.manage']);
const shape = {
  'draft.save': ['requestId', 'expectedRevision', 'profile'],
  'publication.manage': ['requestId', 'expectedRevision', 'expectedGeneration', 'action'],
};
const requestId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const safeInteger = value => Number.isSafeInteger(value) && value >= 0;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function snapshot(value, depth = 0, counter = {nodes: 0}) {
  if (++counter.nodes > 256 || depth > 6) throw new TypeError('Invalid command');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (Array.isArray(value)) {
    if (value.length > 64 || Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError('Invalid array');
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new TypeError('Sparse array');
    return value.map(item => snapshot(item, depth + 1, counter));
  }
  if (!plain(value)) throw new TypeError('Invalid command');
  const output = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError('Invalid key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Accessor rejected');
    Object.defineProperty(output, key, {value: snapshot(descriptor.value, depth + 1, counter), enumerable: true, configurable: true, writable: true});
  }
  return output;
}
function serialize(operation, input) {
  if (!operations.has(operation) || !plain(input)) return null;
  try {
    const keys = Reflect.ownKeys(input);
    if (keys.length !== shape[operation].length || keys.some(key => !shape[operation].includes(key))) return null;
    const data = snapshot(input);
    if (!requestId(data.requestId) || !safeInteger(data.expectedRevision)) return null;
    if (operation === 'publication.manage' && (!safeInteger(data.expectedGeneration) || !['publish', 'withdraw'].includes(data.action))) return null;
    const body = JSON.stringify(data);
    return new TextEncoder().encode(body).length <= 16384 ? body : null;
  } catch { return null; }
}
const result = (ok, code) => Object.freeze({ok, code});
export function createProviderCommandClient({enabled = false, send, onChange = () => {}, timeoutMs = 5000, schedule = setTimeout, cancel = clearTimeout} = {}) {
  if (typeof onChange !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || typeof schedule !== 'function' || typeof cancel !== 'function') throw new TypeError('Invalid client configuration');
  let session = null, revision = 0, pending = null, unknown = null;
  const emit = (status, code) => onChange(Object.freeze(code ? {status, code} : {status}));
  function invalidate() { revision++; pending?.abort(); pending = null; }
  async function dispatch(command) {
    if (pending || session === null || enabled !== true || typeof send !== 'function') return result(false, 'UNAVAILABLE');
    const version = revision, controller = new AbortController();
    pending = controller;
    emit('pending');
    let timer, rejectStop;
    const stopped = new Promise((resolve, reject) => { rejectStop = () => reject(new Error('Command stopped')); });
    const stop = () => controller.abort();
    controller.signal.addEventListener('abort', rejectStop, {once: true});
    try {
      timer = schedule(stop, timeoutMs);
      const response = await Promise.race([Promise.resolve().then(() => controller.signal.aborted ? Promise.reject(new Error('Cancelled')) : send(Object.freeze({...command}), {signal: controller.signal})), stopped]);
      if (version !== revision) return result(false, 'STALE');
      if (response?.status === 200 && response.body?.ok === true &&
          (command.operation === 'draft.save' ? ['saved', 'replayed'].includes(response.body.status) && requestId(response.body.providerId) && safeInteger(response.body.revision) : ['applied', 'replayed'].includes(response.body.status) && requestId(response.body.providerId) && safeInteger(response.body.generation) && ['publish', 'withdraw'].includes(response.body.action))) {
        unknown = null; emit('success'); return result(true, 'SUCCESS');
      }
      if (response?.status === 202 && response.body?.error?.code === 'OUTCOME_UNKNOWN' && response.body?.retrySameRequest === true) {
        unknown = command; emit('unknown', 'OUTCOME_UNKNOWN'); return result(false, 'OUTCOME_UNKNOWN');
      }
      if ([400, 401, 403, 408, 409, 429, 503, 504].includes(response?.status)) {
        unknown = null; emit('error', 'HTTP_' + response.status); return result(false, 'HTTP_' + response.status);
      }
      // An unrecognized/failed response may hide a completed write.
      unknown = command; emit('unknown', 'OUTCOME_UNKNOWN'); return result(false, 'OUTCOME_UNKNOWN');
    } catch {
      if (version !== revision) return result(false, 'STALE');
      unknown = command; emit('unknown', 'OUTCOME_UNKNOWN'); return result(false, 'OUTCOME_UNKNOWN');
    } finally {
      if (timer !== undefined) cancel(timer);
      controller.signal.removeEventListener('abort', rejectStop);
      if (version === revision) pending = null;
    }
  }
  return Object.freeze({
    setSession(key) {
      if (typeof key !== 'string' || !requestId(key)) { invalidate(); session = null; unknown = null; emit('idle'); return; }
      if (session === key) return;
      invalidate(); session = key; unknown = null; emit('idle');
    },
    submit(operation, input) {
      if (unknown || pending) return Promise.resolve(result(false, 'PENDING_RECONCILIATION'));
      const body = serialize(operation, input);
      if (body === null) return Promise.resolve(result(false, 'INVALID_REQUEST'));
      return dispatch(Object.freeze({operation, body}));
    },
    retryUnknown() { return unknown ? dispatch(unknown) : Promise.resolve(result(false, 'NO_UNKNOWN_OUTCOME')); },
    clear() { invalidate(); unknown = null; emit('idle'); },
  });
}
