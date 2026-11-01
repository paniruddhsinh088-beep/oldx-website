import { normalizeProviderProfile } from './provider-profile.mjs';
import { normalizeServiceSelections } from './service-selections.mjs';

// UI-only draft state, never authorization or persistence. Consent remains local
// and independent; no contact values are collected or published in the preview.
export function inspectProviderPreviewDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    return { ok: false, errors: { form: 'INVALID_PROFILE' }, completed: 0, required: 4 };
  }
  const errors = {};
  const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 &&
    value.trim().length <= max && !/[<>\u0000-\u001f\u007f]/u.test(value);
  for (const [field, max] of [['displayName', 80], ['city', 80], ['serviceArea', 120]]) {
    if (!validText(input[field], max)) errors[field] = 'INVALID_TEXT';
  }
  if (!normalizeServiceSelections(input.services).ok) errors.services = 'INVALID_SERVICES';
  const experience = input.experienceYears;
  const years = experience === '' || experience === undefined ? undefined
    : typeof experience === 'string' && /^\d{1,2}$/.test(experience) ? Number(experience) : experience;
  if (years !== undefined && (!Number.isInteger(years) || years < 0 || years > 80)) errors.experienceYears = 'INVALID_EXPERIENCE';
  if (input.description !== undefined && (typeof input.description !== 'string' ||
      input.description.length > 1200 || /[<>\u0000-\u001f\u007f]/u.test(input.description))) errors.description = 'INVALID_DESCRIPTION';
  if (typeof input.available !== 'boolean') errors.available = 'INVALID_AVAILABILITY';
  if (typeof input.phoneConsent !== 'boolean' || typeof input.whatsappConsent !== 'boolean') errors.contact = 'INVALID_CONSENT';
  const completed = ['displayName', 'city', 'serviceArea', 'services'].filter(field => !Object.hasOwn(errors, field)).length;
  if (Object.keys(errors).length) return { ok: false, errors, completed, required: 4 };
  const result = normalizeProviderProfile({
    displayName: input.displayName, city: input.city, serviceArea: input.serviceArea,
    services: input.services, experienceYears: years, description: input.description,
    available: input.available
  });
  if (!result.ok) return { ok: false, errors: { form: result.code }, completed, required: 4 };
  return {
    ok: true, errors: {}, completed, required: 4, profile: result.value,
    consent: { phone: input.phoneConsent, whatsapp: input.whatsappConsent }
  };
}
