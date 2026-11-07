// Shared plain-text draft schema for synthetic conversation previews only.
// Validation is not chat membership, rate limiting or permission to send.
const MAX_CODE_UNITS = 2000;
// Preserve Indic combining marks, ZWJ/ZWNJ, emoji and ordinary newlines. Reject
// explicit direction overrides/isolates that can visually spoof message authorship.
const UNSAFE_CHARACTERS = /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

function hasUnpairedSurrogate(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function normalizeMessageDraft(value) {
  if (typeof value !== 'string' || value.length > MAX_CODE_UNITS ||
      UNSAFE_CHARACTERS.test(value) || hasUnpairedSurrogate(value)) return null;
  const normalized = value.normalize('NFC').trim();
  return normalized.length > 0 && normalized.length <= MAX_CODE_UNITS
    ? normalized : null;
}
