import { buildProviderShareMetadata } from "./provider-share.mjs";

/**
 * Trusted QR input only. A QR renderer may encode value.text as a URL.
 * This does NOT draw a QR code, fetch resources or write data.
 */
export function buildProviderQrPayload(profile) {
  const result = buildProviderShareMetadata(profile);
  if (!result.ok) return result;
  const { url } = result.value;
  if (url.length > 256) return { ok: false, code: "QR_URL_TOO_LONG" };
  return {
    ok: true,
    value: {
      text: url,
      format: "url",
      errorCorrectionLevel: "M",
      caption: "Scan to view OLDX service provider",
    }
  };
}
