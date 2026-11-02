const SURFACES = Object.freeze({
  product: Object.freeze({ maxFiles: 6, maxBytes: 5 * 1024 * 1024, maxDimension: 2048, maxPixels: 12_000_000, visibility: "approved-public-derivative" }),
  store: Object.freeze({ maxFiles: 1, maxBytes: 5 * 1024 * 1024, maxDimension: 2048, maxPixels: 12_000_000, visibility: "moderated-public-image" }),
  profile: Object.freeze({ maxFiles: 1, maxBytes: 2 * 1024 * 1024, maxDimension: 1024, maxPixels: 4_000_000, visibility: "private-by-default" }),
  chat: Object.freeze({ maxFiles: 1, maxBytes: 3 * 1024 * 1024, maxDimension: 1600, maxPixels: 8_000_000, visibility: "participants-only" }),
});

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function getSurfacePolicy(surface) {
  return typeof surface === "string" && Object.hasOwn(SURFACES, surface) ? SURFACES[surface] : null;
}

// Validates server-derived metadata after the trusted processor has decoded the bytes.
// This helper does not inspect files or prove that metadata is truthful.
export function validateProcessedImage({ surface, contentType, byteSize, width, height, fileCount = 1 } = {}) {
  const policy = getSurfacePolicy(surface);
  const errors = [];
  if (!policy) errors.push("unsupported_surface");
  if (!ALLOWED_TYPES.has(contentType)) errors.push("unsupported_content_type");
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || (policy && byteSize > policy.maxBytes)) errors.push("invalid_byte_size");
  if (!Number.isSafeInteger(width) || width <= 0 || (policy && width > policy.maxDimension)) errors.push("invalid_width");
  if (!Number.isSafeInteger(height) || height <= 0 || (policy && height > policy.maxDimension)) errors.push("invalid_height");
  if (policy && Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width * height > policy.maxPixels) errors.push("pixel_limit_exceeded");
  if (!Number.isSafeInteger(fileCount) || fileCount <= 0 || (policy && fileCount > policy.maxFiles)) errors.push("file_count_exceeded");
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), policy: policy ? Object.freeze({ ...policy }) : null });
}

export function validateUploadGrantRequest({ authenticatedUid, surface, parentId, imageId, expiresInSeconds } = {}) {
  const errors = [];
  if (typeof authenticatedUid !== "string" || !authenticatedUid.trim()) errors.push("authentication_required");
  if (!getSurfacePolicy(surface)) errors.push("unsupported_surface");
  if (typeof imageId !== "string" || !/^[A-Za-z0-9_-]{20,80}$/.test(imageId)) errors.push("invalid_image_id");
  if (parentId !== undefined && (typeof parentId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(parentId))) errors.push("invalid_parent_id");
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 300) errors.push("invalid_grant_expiry");
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export const IMAGE_UPLOAD_SURFACES = Object.freeze(Object.keys(SURFACES));
