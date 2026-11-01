const MAX_REFERENCES = 10_000;
const KNOWN_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "res.cloudinary.com",
  "lh3.googleusercontent.com"
]);

function classifyOne(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_000_000) {
    return "invalid_reference";
  }

  const candidate = value.trim();
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/]*={0,2}$/i.test(candidate)) {
    return "legacy_data_url";
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return "invalid_reference";
  }

  if (parsed.protocol === "http:") return "insecure_http_review";
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return "invalid_reference";
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (KNOWN_HOSTS.has(host)) return "approved_host_candidate";
  return "external_https_review";
}

/**
 * Synthetic/local-only classifier. Does not fetch, decode, log or mutate values.
 * The result intentionally contains no original URL or data URL.
 */
export function classifyProductImageReferences(values) {
  if (!Array.isArray(values)) {
    throw new TypeError("Image references must be supplied as an array.");
  }

  const processed = values.slice(0, MAX_REFERENCES);
  const counts = {
    legacy_data_url: 0,
    approved_host_candidate: 0,
    external_https_review: 0,
    insecure_http_review: 0,
    invalid_reference: 0
  };

  const entries = processed.map((value, index) => {
    const classification = classifyOne(value);
    counts[classification] += 1;
    return { index, classification };
  });

  return {
    processedCount: processed.length,
    totalInputCount: values.length,
    truncated: values.length > MAX_REFERENCES,
    counts,
    entries
  };
}
