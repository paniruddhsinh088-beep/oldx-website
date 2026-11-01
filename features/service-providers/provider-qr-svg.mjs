import { buildProviderQrPayload } from "./provider-qr-payload.mjs";

/**
 * Create a real QR SVG through a trusted, locally installed QR encoder.
 * The caller supplies a QR encoder function (for example a vetted
 * package's toString function). No external QR API or network calls.
 * This module itself does not install dependencies or publish anything.
 */
export async function renderProviderQrSvg(profile, toString) {
  const payload = buildProviderQrPayload(profile);
  if (!payload.ok) return payload;
  if (typeof toString !== "function") return { ok: false, code: "QR_ENCODER_UNAVAILABLE" };
  try {
    const svg = await toString(payload.value.text, {
      type: "svg", errorCorrectionLevel: "M", margin: 2, width: 256
    });
    // Restrict QR markup to the simple vector geometry emitted by the
    // approved encoder. Arbitrary SVG can contain scripts, links or CSS.
    const validSvg = typeof svg === "string" && svg.length <= 200000 &&
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"(?: width="[0-9]+" height="[0-9]+")?(?: viewBox="[0-9 .]+")?>(?:<path d="[MmLlHhVvZz0-9., +\\-]+"(?: fill="#[0-9a-fA-F]{3,8}")?\/>)+<\/svg>$/.test(svg);
    if (!validSvg) return { ok: false, code: "UNSAFE_QR_SVG" };
    return { ok: true, value: { svg, mimeType: "image/svg+xml", url: payload.value.text } };
  } catch {
    return { ok: false, code: "QR_ENCODING_FAILED" };
  }
}
