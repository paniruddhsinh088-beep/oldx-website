const MAX_NAME = 80;
const MAX_SAVED_ADS = 100;
const MAX_BLOCKED_USERS = 200;
const APPROVED_PHOTO_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "firebasestorage.googleapis.com",
  "res.cloudinary.com"
]);

function boundedString(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;
}

function safePhotoUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !APPROVED_PHOTO_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function uniqueSyntheticSafeIds(value, max) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    item => typeof item === "string" &&
      item.length >= 1 && item.length <= 128 &&
      /^[A-Za-z0-9_-]+$/.test(item)
  ))].slice(0, max);
}

/**
 * Pure allowlist projection for synthetic/local migration tests.
 * No Firestore, network, environment, or filesystem access.
 */
export function projectLegacyUser(legacy = {}) {
  const publicProfile = {};
  const displayName = boundedString(legacy.displayName, MAX_NAME);
  const photoURL = safePhotoUrl(legacy.photoURL);
  if (displayName) publicProfile.displayName = displayName;
  if (photoURL) publicProfile.photoURL = photoURL;

  return {
    publicProfile,
    privateProfile: {
      savedAds: uniqueSyntheticSafeIds(legacy.savedAds, MAX_SAVED_ADS),
      blockedUsers: uniqueSyntheticSafeIds(legacy.blockedUsers, MAX_BLOCKED_USERS)
    }
  };
}

/**
 * Target values win over stale legacy projections. This is a pure helper,
 * not a database merge or a migration runner.
 */
export function preserveNewerTarget(target = {}, proposed = {}) {
  return { ...proposed, ...target };
}
