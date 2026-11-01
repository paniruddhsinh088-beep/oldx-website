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
    // Remove only the standard SVG namespace before looking for remote URLs.
    const svgWithoutNamespace = typeof svg === "string"
      ? svg.replace('xmlns="http://www.w3.org/2000/svg"', "") : "";
    const startsWithSvg = typeof svg === "string" &&
      svg.trimStart().startsWith('<svg xmlns="http://www.w3.org/2000/svg"');
    const forbidden = ["<script", "<foreignObject", "<image", "<iframe", "<use",
      "javascript:", "http://", "https://", "onload=", "onclick=", "onerror="];
    if (!startsWithSvg || svg.length > 200000 ||
        forbidden.some(fragment => svgWithoutNamespace.toLowerCase().includes(fragment.toLowerCase()))) {
      return { ok: false, code: "UNSAFE_QR_SVG" };
    }
    return { ok: true, value: { svg, mimeType: "image/svg+xml", url: payload.value.text } };
  } catch {
    return { ok: false, code: "QR_ENCODING_FAILED" };
  }
}
