import { buildPublicProviderCard } from './provider-public-card.mjs';
import { normalizeServiceSelections } from './service-selections.mjs';

// Pure projection of already-approved PUBLIC data, never a publication or
// authorization decision. Do not fetch legacy/private documents in a browser
// and rely on this projector as a substitute for a trusted public read boundary.
export function buildPublicProviderProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype) {
    return { ok: false, code: 'INVALID_PUBLIC_PROVIDER' };
  }
  const card = buildPublicProviderCard(input);
  if (!card.ok || !/^[A-Za-z0-9_-]{1,100}$/.test(input.id) ||
      !normalizeServiceSelections(input.services).ok) {
    return { ok: false, code: 'INVALID_PUBLIC_PROVIDER' };
  }
  if ([card.card.displayName, card.card.city, card.card.serviceArea].some(value => /[\u007f-\u009f]/u.test(value))) return { ok: false, code: 'INVALID_PUBLIC_PROVIDER' };
  const description = input.description ?? '';
  const languages = input.languages ?? [];
  if (typeof description !== 'string' || description.length > 1200 ||
      /[<>\u0000-\u001f\u007f-\u009f]/u.test(description) ||
      !Array.isArray(languages) || languages.length > 3 ||
      [...languages].some(code => !['gu', 'hi', 'en'].includes(code)) ||
      new Set(languages).size !== languages.length) {
    return { ok: false, code: 'INVALID_PUBLIC_PROVIDER' };
  }
  return {
    ok: true,
    profile: { ...card.card, description: description.trim(), languages: [...languages] }
  };
}
