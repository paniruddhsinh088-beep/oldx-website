/**
 * Review-only, in-memory Store catalogue view model for a PRE-BOUNDED batch of
 * trusted, already-public listing documents. This is not a Firestore query,
 * publication check, authorization check, or migration tool.
 *
 * Callers must fetch only approved publicProducts from a trusted boundary and
 * use server-side cursor pagination for the full catalogue. Never pass legacy
 * products documents to a public client as a substitute for that boundary.
 */

const CATEGORY_IDS = new Set([
  "cars", "properties", "mobiles", "bikes", "electronics", "commercial",
  "furniture", "fashion", "books", "pets", "jobs", "services"
]);
const SORT_MODES = new Set(["newest", "name", "price-low", "price-high", "available"]);
const MAX_BATCH = 100;
const MAX_PAGE_SIZE = 24;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const FORBIDDEN_TEXT = /[<>\u0000-\u001f\u007f-\u009f]/u;
const priceFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function normalizedText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFC").trim();
  return text.length > 0 && text.length <= max && !FORBIDDEN_TEXT.test(text) ? text : null;
}

function timestampMillis(value) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (!plainRecord(value) || !Number.isSafeInteger(value.seconds) || value.seconds < 0 ||
      !Number.isInteger(value.nanoseconds) || value.nanoseconds < 0 || value.nanoseconds >= 1e9) {
    return null;
  }
  const millis = value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
  return Number.isSafeInteger(millis) ? millis : null;
}

function projectListing(value, storeUid) {
  if (!plainRecord(value) || value.sellerUid !== storeUid ||
      typeof value.id !== "string" || !ID_PATTERN.test(value.id) ||
      !CATEGORY_IDS.has(value.category) || typeof value.isSold !== "boolean" ||
      typeof value.basePrice !== "number" || !Number.isFinite(value.basePrice) ||
      value.basePrice < 0 || value.basePrice > 1_000_000_000) return null;

  const title = normalizedText(value.title, 120);
  if (!title) return null;
  const price = Math.round(value.basePrice);
  return {
    // Explicit allowlist: never copy phone, IP, coordinates, contact consent,
    // private attributes, raw images, or client-supplied verification badges.
    card: { id: value.id, title, category: value.category, price,
      priceLabel: "₹" + priceFormatter.format(price), available: !value.isSold },
    createdAtMs: timestampMillis(value.createdAt)
  };
}

/**
 * @returns {{ok:true,items:Array,matchedCount:number,skippedCount:number,
 *            hasMoreInBatch:boolean,page:number,pageSize:number} |
 *           {ok:false,code:string}}
 */
export function buildStoreCataloguePage(options = {}) {
  if (!plainRecord(options)) return { ok: false, code: "INVALID_CATALOGUE_INPUT" };
  const { storeUid, listings, query = "", category = "all", sort = "newest",
    page = 1, pageSize = 12 } = options;
  if (typeof storeUid !== "string" || !ID_PATTERN.test(storeUid) ||
      !Array.isArray(listings) || listings.length > MAX_BATCH ||
      !Number.isInteger(page) || page < 1 || page > MAX_BATCH ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE ||
      typeof query !== "string" || query.length > 80 || FORBIDDEN_TEXT.test(query) ||
      (category !== "all" && !CATEGORY_IDS.has(category)) || !SORT_MODES.has(sort)) {
    return { ok: false, code: "INVALID_CATALOGUE_INPUT" };
  }

  const search = query.normalize("NFC").trim().toLocaleLowerCase("en");
  const accepted = [];
  const seenIds = new Set();
  let skippedCount = 0;
  for (const record of listings) {
    const projected = projectListing(record, storeUid);
    if (!projected || seenIds.has(projected.card.id)) {
      skippedCount++;
      continue;
    }
    seenIds.add(projected.card.id);
    if (category !== "all" && projected.card.category !== category) continue;
    if (search && !projected.card.title.toLocaleLowerCase("en").normalize("NFC").includes(search)) continue;
    accepted.push(projected);
  }

  const newest = (a, b) => (b.createdAtMs ?? -1) - (a.createdAtMs ?? -1);
  const byId = (a, b) => a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0;
  accepted.sort((a, b) => {
    let order = 0;
    if (sort === "name") order = a.card.title.localeCompare(b.card.title, "en", { sensitivity: "base", numeric: true });
    else if (sort === "price-low") order = a.card.price - b.card.price;
    else if (sort === "price-high") order = b.card.price - a.card.price;
    else if (sort === "available") order = Number(b.card.available) - Number(a.card.available) || newest(a, b);
    else order = newest(a, b);
    return order || byId(a, b);
  });

  const offset = (page - 1) * pageSize;
  return {
    ok: true,
    items: accepted.slice(offset, offset + pageSize).map(item => item.card),
    matchedCount: accepted.length,
    skippedCount,
    hasMoreInBatch: offset + pageSize < accepted.length,
    page,
    pageSize
  };
}
