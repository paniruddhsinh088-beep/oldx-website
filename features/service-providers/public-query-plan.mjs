/**
 * INACTIVE logical query plan for an APPROVED public-only provider index.
 * This is not a Firestore query, cursor signer, authorization check, public
 * document migration, or a substitute for a trusted server read boundary.
 * No browser/SDK/transport integration is supplied.
 */
export const PUBLIC_PROVIDER_QUERY_FIELDS = Object.freeze([
  'id', 'displayName', 'city', 'serviceArea', 'services', 'available',
  'experienceYears', 'description', 'languages'
]);
export const PUBLIC_PROVIDER_QUERY_MAX_LIMIT = 24;
const DENIED = Object.freeze({ ok: false, code: 'PUBLIC_PROVIDER_QUERY_UNAVAILABLE' });
const KEY = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]{0,63}$/u;
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,100}$/u;
const TOKEN = /^[A-Za-z0-9._~-]{1,512}$/u;
const INPUT_KEYS = new Set(['serviceKey', 'cityKey', 'availableOnly', 'limit', 'cursor']);
const OPTIONS_KEYS = new Set(['enabled', 'verifyCursor']);

function ownData(record, key) {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}
function plainData(record, allowed) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      Object.getPrototypeOf(record) !== Object.prototype) return false;
  return Reflect.ownKeys(record).every(key =>
    typeof key === 'string' && allowed.has(key) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(record, key), 'value'));
}
function canonicalKey(value) {
  if (typeof value !== 'string' || value.length > 128) return null;
  const key = value.normalize('NFC').toLowerCase();
  return KEY.test(key) && key.length <= 64 ? key : null;
}

/**
 * @param {object} input - Public search filters, never identity or raw query paths.
 * @param {object} dependencies - Server-owned flags/verifier; not browser inputs.
 * @returns {object} A logical, bounded public index plan or a generic denial.
 */
export function planPublicProviderQuery(input, dependencies = {}) {
  try {
    if (!plainData(input, INPUT_KEYS) || !plainData(dependencies, OPTIONS_KEYS) ||
        ownData(dependencies, 'enabled') !== true) return DENIED;

    const rawService = ownData(input, 'serviceKey') ?? '';
    const rawCity = ownData(input, 'cityKey') ?? '';
    const availableOnly = ownData(input, 'availableOnly') ?? false;
    const limit = ownData(input, 'limit') ?? 12;
    const cursor = ownData(input, 'cursor') ?? null;
    const serviceKey = rawService === '' ? '' : canonicalKey(rawService);
    const cityKey = rawCity === '' ? '' : canonicalKey(rawCity);
    if (serviceKey === null || cityKey === null || (!serviceKey && !cityKey) ||
        typeof availableOnly !== 'boolean' || !Number.isSafeInteger(limit) ||
        limit < 1 || limit > PUBLIC_PROVIDER_QUERY_MAX_LIMIT) return DENIED;

    // A cursor is never accepted on shape alone: a future trusted server must
    // verify authenticity, expiry and scope before the plan may use it.
    const scopeKey = JSON.stringify([serviceKey, cityKey, availableOnly]);
    let afterProviderId = null;
    if (cursor !== null) {
      const verifyCursor = ownData(dependencies, 'verifyCursor');
      if (typeof cursor !== 'string' || !TOKEN.test(cursor) ||
          typeof verifyCursor !== 'function') return DENIED;
      const verified = verifyCursor(cursor, scopeKey);
      if (!plainData(verified, new Set(['scopeKey', 'afterProviderId'])) ||
          ownData(verified, 'scopeKey') !== scopeKey ||
          typeof ownData(verified, 'afterProviderId') !== 'string' ||
          !PROVIDER_ID.test(ownData(verified, 'afterProviderId'))) return DENIED;
      afterProviderId = ownData(verified, 'afterProviderId');
    }
    return {
      ok: true,
      plan: {
        publicOnly: true,
        requiresTrustedRepository: true,
        scopeKey,
        filters: { serviceKey, cityKey, availableOnly, publishedOnly: true },
        order: 'provider-id-ascending',
        afterProviderId,
        limit,
        fields: [...PUBLIC_PROVIDER_QUERY_FIELDS]
      }
    };
  } catch {
    // Malformed proxy/accessor/verifier failures are never returned to clients.
    return DENIED;
  }
}
