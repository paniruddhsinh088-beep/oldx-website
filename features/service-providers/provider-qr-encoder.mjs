/**
 * Offline QR encoder integration for the review-only Service Providers feature.
 * Uses the open-source "qrcode" package; no remote API or Firebase Storage.
 * The package is loaded only when the user requests a QR image.
 */
export async function encodeProviderQrSvg(url, options, load = () => import("qrcode")) {
  if (typeof url !== "string" || !/^https:\/\/(?:www\.)?oldxbazar\.in\/services\/provider\/[A-Za-z0-9_-]{1,100}$/.test(url)) {
    throw new TypeError("Invalid OLDX provider URL");
  }
  const qr = await load();
  const toString = qr?.toString ?? qr?.default?.toString;
  if (typeof toString !== "function") throw new TypeError("QR encoder unavailable");
  return toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    ...options,
    // Keep the output SVG predictable; do not allow caller overrides.
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256
  });
}
