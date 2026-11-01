const MAX_TITLE = 120;
const MAX_DESCRIPTION = 5000;
const MAX_LOCATION = 160;
const MAX_SELLER_NAME = 80;
const MAX_IMAGES = 8;
const MAX_PRICE = 1_000_000_000;
const IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "res.cloudinary.com",
  "lh3.googleusercontent.com"
]);

function boundedText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function safeId(value) {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

function finiteNumber(value, min, max) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function safeImageReferences(value) {
  if (!Array.isArray(value)) return [];
  const output = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || candidate.length > 2048) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname)) continue;
      output.push(url.toString());
    } catch {
      // Ignore malformed or non-URL legacy image data (including data URLs).
    }
    if (output.length === MAX_IMAGES) break;
  }
  return [...new Set(output)];
}

function safeCoordinates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const latitude = finiteNumber(value.latitude ?? value.lat, -90, 90);
  const longitude = finiteNumber(value.longitude ?? value.lng ?? value.lon, -180, 180);
  return latitude === null || longitude === null
    ? null
    : { latitude, longitude };
}

/**
 * Deterministic, pure allowlist transform for synthetic/local review only.
 * It never writes to Firestore or reads runtime configuration.
 *
 * Legacy contact data is held in the private projection with consent=false.
 * Exact coordinates remain private. Server timestamps, publication approval,
 * featured and verified flags are deliberately not copied from legacy input.
 */
export function projectLegacyProduct(legacy = {}) {
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    throw new TypeError("Legacy product must be an object");
  }

  const sellerUid = safeId(legacy.sellerUid) ? legacy.sellerUid : null;
  const title = boundedText(legacy.title, MAX_TITLE);
  const basePrice = finiteNumber(legacy.basePrice, 0, MAX_PRICE);
  const mrpPrice = finiteNumber(legacy.mrpPrice, 0, MAX_PRICE);
  const discountPercent = finiteNumber(legacy.discountPercent, 0, 100);

  const publicProduct = {};
  if (sellerUid) publicProduct.sellerUid = sellerUid;
  const sellerDisplayName = boundedText(legacy.sellerName, MAX_SELLER_NAME);
  if (sellerDisplayName) publicProduct.sellerDisplayName = sellerDisplayName;
  for (const [source, target, max] of [
    ["category", "category", 64],
    ["subCategory", "subCategory", 64],
    ["title", "title", MAX_TITLE],
    ["desc", "description", MAX_DESCRIPTION],
    ["location", "locationLabel", MAX_LOCATION],
    ["state", "state", 64]
  ]) {
    const value = boundedText(legacy[source], max);
    if (value) publicProduct[target] = value;
  }
  if (basePrice !== null) publicProduct.basePrice = basePrice;
  if (mrpPrice !== null) publicProduct.mrpPrice = mrpPrice;
  if (discountPercent !== null) publicProduct.discountPercent = discountPercent;
  publicProduct.images = safeImageReferences(legacy.images);
  publicProduct.isSold = typeof legacy.isSold === "boolean" ? legacy.isSold : false;

  // Migration never grants publication or privileged marketplace status.
  publicProduct.publicationStatus = "pending_review";
  publicProduct.isFeatured = false;
  publicProduct.isShopVerified = false;

  const privateProduct = {};
  if (sellerUid) privateProduct.sellerUid = sellerUid;
  const phone = boundedText(legacy.phone, 40);
  if (phone) privateProduct.legacyContactPhone = phone;
  privateProduct.contactConsent = false;
  const coordinates = safeCoordinates(legacy.coords);
  if (coordinates) privateProduct.exactCoordinates = coordinates;

  return { publicProduct, privateProduct };
}
