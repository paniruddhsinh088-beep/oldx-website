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
    // Accept the simple geometry emitted by common offline QR encoders.
    // Reject all XML elements and attributes outside this allowlist.
    const safeSvg = value => {
      if (typeof value !== "string" || value.length > 200000 ||
          /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) return false;
      const source = value.trim();
      const root = source.match(/^<svg\s+([^<>]+)>([\s\S]*)<\/svg>$/);
      if (!root) return false;
      const attrs = root[1];
      if (!/\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(attrs)) return false;
      const allowedRoot = /(?:^|\s)(?:xmlns|width|height|viewBox|shape-rendering)="[^"<>]*"/g;
      if (attrs.replace(allowedRoot, "").trim() !== "") return false;
      const paths = root[2].trim().replace(/<path\s+([^<>]*?)\s*\/>/g, (_tag, pathAttrs) => {
        const allowed = /\s*(?:fill|stroke|stroke-width|d)="[^"<>]*"/g;
        if (pathAttrs.replace(allowed, "").trim() !== "") return "INVALID";
        const d = pathAttrs.match(/(?:^|\s)d="([^"]+)"/);
        if (!d || !/^[MmLlHhVvZzCcSsQqTtAa0-9.,+\-\s]+$/.test(d[1])) return "INVALID";
        const paint = [...pathAttrs.matchAll(/(?:fill|stroke)="([^"]+)"/g)];
        if (paint.some(m => !/^(?:#[0-9a-fA-F]{3,8}|none)$/.test(m[1]))) return "INVALID";
        return "";
      });
      return paths === "" && /<path\s/.test(root[2]);
    };
    if (!safeSvg(svg)) return { ok: false, code: "UNSAFE_QR_SVG" };
    return { ok: true, value: { svg, mimeType: "image/svg+xml", url: payload.value.text } };
  } catch {
    return { ok: false, code: "QR_ENCODING_FAILED" };
  }
}
