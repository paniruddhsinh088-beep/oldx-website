import { buildProviderShareMetadata } from "./provider-share.mjs";

/**
 * Build a privacy-safe share card model from approved public profile fields.
 * The caller renders this model to a card or image. This function does not
 * fetch photos, render graphics, publish a page or generate QR bitmaps.
 */
export function buildProviderShareCard(profile) {
  const share = buildProviderShareMetadata(profile);
  if (!share.ok) return share;
  const { displayName, city, services, photoUrl } = profile;
  let safePhotoUrl = null;
  if (photoUrl !== undefined && photoUrl !== null && photoUrl !== "") {
    if (typeof photoUrl !== "string") return { ok: false, code: "INVALID_PHOTO_URL" };
    try {
      const url = new URL(photoUrl);
      // Explicit allowlist prevents tracking URLs and arbitrary image hosts.
      if (url.protocol !== "https:" || url.username || url.password ||
          url.port || !["res.cloudinary.com", "firebasestorage.googleapis.com"].includes(url.hostname) ||
          url.hash || url.toString() !== photoUrl) {
        return { ok: false, code: "INVALID_PHOTO_URL" };
      }
      safePhotoUrl = url.toString();
    } catch {
      return { ok: false, code: "INVALID_PHOTO_URL" };
    }
  }
  return {
    ok: true,
    value: {
      title: share.value.title,
      description: share.value.description,
      url: share.value.url,
      displayName: displayName.trim(),
      city: city.trim(),
      services: services.map(s => s.trim()).slice(0, 3),
      photoUrl: safePhotoUrl,
      brand: "OLDX"
    }
  };
}
