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
  if (typeof share === "function") {
    try {
      await share({ title, text: description, url });
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
