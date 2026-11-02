import { buildProviderShareMetadata } from "./provider-share.mjs";

/**
 * Review-only mobile share action. Call directly from a user click/tap.
 * Dependency injection makes it testable without a browser or network.
 * It does not create a preview image, QR bitmap or a live provider page.
 */
export async function shareProviderProfile(profile, { share, writeText } = {}) {
  const prepared = buildProviderShareMetadata(profile);
  if (!prepared.ok) return prepared;
  const { title, description, url } = prepared.value;
  return shareProviderLink({ title, text: description, url }, { share, writeText });
}

// Transport only: callers prepare a trusted public/preview link first. This
// function never publishes a page or infers authorization from a URL.
export async function shareProviderLink(input, { share, writeText } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      typeof input.title !== 'string' || input.title.length > 300 ||
      typeof input.text !== 'string' || input.text.length > 2000 ||
      typeof input.url !== 'string' || input.url.length > 2048) {
    return { ok: false, code: 'INVALID_SHARE_DATA' };
  }
  const { title, text, url } = input;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)))) {
      return { ok: false, code: 'INVALID_SHARE_DATA' };
    }
  } catch { return { ok: false, code: 'INVALID_SHARE_DATA' }; }
  if (typeof share === "function") {
    try {
      await share({ title, text, url });
      return { ok: true, method: "native" };
    } catch (error) {
      // A cancelled native share must not silently copy the URL.
      if (error?.name === "AbortError") return { ok: false, code: "SHARE_CANCELLED" };
      // Other native share failures may fall back to copy-link.
    }
  }
  if (typeof writeText === "function") {
    try {
      await writeText(url);
      return { ok: true, method: "clipboard" };
    } catch {
      return { ok: false, code: "CLIPBOARD_UNAVAILABLE", url };
    }
  }
  return { ok: false, code: "SHARE_UNAVAILABLE", url };
}
