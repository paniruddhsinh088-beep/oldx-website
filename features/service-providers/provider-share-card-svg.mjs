import { buildProviderShareCard } from "./provider-share-card.mjs";

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
})[char]);

/**
 * Render an offline SVG preview from approved public profile fields.
 * Photo is deliberately NOT embedded: externally hosted images can track
 * viewers, fail offline or be blocked when converting SVG to PNG.
 * A trusted same-origin image proxy can be added after security review.
 */
export function renderProviderShareCardSvg(profile) {
  const card = buildProviderShareCard(profile);
  if (!card.ok) return card;
  const { displayName, city, services, url } = card.value;
  const serviceLines = services.map((service, index) =>
    `<text x="56" y="${284 + index * 42}" font-size="25" fill="#334155">${escapeXml(service)}</text>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520">
<rect width="720" height="520" rx="28" fill="#f8fafc"/>
<rect width="720" height="112" rx="28" fill="#0f172a"/>
<text x="56" y="76" font-size="44" font-weight="bold" fill="#ffffff">OLDX Services</text>
<text x="56" y="168" font-size="36" font-weight="bold" fill="#0f172a">${escapeXml(displayName)}</text>
<text x="56" y="214" font-size="26" fill="#475569">${escapeXml(city)}</text>
${serviceLines}
<line x1="56" y1="436" x2="664" y2="436" stroke="#cbd5e1"/>
<text x="56" y="475" font-size="17" fill="#334155">${escapeXml(url)}</text>
</svg>`;
  return { ok: true, value: { svg, mimeType: "image/svg+xml", photoIncluded: false } };
}
