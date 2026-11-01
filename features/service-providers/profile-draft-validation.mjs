// Pure input validation for the proposed service-provider profile draft.
// Not an authorization boundary; Firestore rules/backend must validate again.
const ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const clean = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max && v === v.trim();
export function validateProviderDraft(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, errors: ['invalid_profile'] };
  const keys = ['displayName', 'serviceIds', 'cityId', 'areaLabel', 'description'];
  if (Object.keys(value).some(k => !keys.includes(k))) errors.push('unexpected_field');
  if (!clean(value.displayName, 80)) errors.push('displayName');
  if (!Array.isArray(value.serviceIds) || value.serviceIds.length < 1 || value.serviceIds.length > 8 ||
      new Set(value.serviceIds).size !== value.serviceIds.length ||
      !value.serviceIds.every(id => typeof id === 'string' && ID.test(id))) errors.push('serviceIds');
  if (typeof value.cityId !== 'string' || !ID.test(value.cityId)) errors.push('cityId');
  if (value.areaLabel !== undefined && (typeof value.areaLabel !== 'string' || value.areaLabel.length > 100)) errors.push('areaLabel');
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 1000)) errors.push('description');
  return { valid: errors.length === 0, errors };
}
