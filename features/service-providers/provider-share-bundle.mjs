import { renderProviderShareCardSvg } from "./provider-share-card-svg.mjs";
import { renderProviderQrSvg } from "./provider-qr-svg.mjs";

/**
 * Compose two offline SVG previews. QR encoder is injected by the caller.
 * The QR SVG is returned separately; browsers can display both side by side
 * without fetching an external QR API. Do not claim the QR is scannable until
 * a real encoder and device scan test have been completed.
 */
export async function buildProviderShareBundle(profile, qrEncoder) {
  const card = renderProviderShareCardSvg(profile);
  if (!card.ok) return card;
  const qr = await renderProviderQrSvg(profile, qrEncoder);
  if (!qr.ok) return qr;
  if (card.value.mimeType !== "image/svg+xml" || qr.value.mimeType !== "image/svg+xml") {
    return { ok: false, code: "UNSUPPORTED_SHARE_FORMAT" };
  }
  return {
    ok: true,
    value: {
      cardSvg: card.value.svg,
      qrSvg: qr.value.svg,
      profileUrl: qr.value.url,
      cardMimeType: card.value.mimeType,
      qrMimeType: qr.value.mimeType
    }
  };
}
