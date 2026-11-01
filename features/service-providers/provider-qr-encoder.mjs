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
  // Plain objects inherit Object.prototype.toString; that is not an encoder.
  // Accept only an explicit export, including CommonJS default interop.
  const toString = qr && Object.hasOwn(qr, "toString") && typeof qr.toString === "function"
    ? qr.toString
    : qr?.default && Object.hasOwn(qr.default, "toString") ? qr.default.toString : undefined;
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
