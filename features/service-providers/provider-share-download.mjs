import { buildProviderShareBundle } from "./provider-share-bundle.mjs";

/**
 * Prepares SVG files for a user-initiated download.
 * The UI must create Blob/object URLs and click a download control in a
 * real user gesture; this helper performs no DOM or network operations.
 */
export async function prepareProviderShareDownloads(profile, qrEncoder) {
  const result = await buildProviderShareBundle(profile, qrEncoder);
  if (!result.ok) return result;
  const { cardSvg, qrSvg, profileUrl } = result.value;
  const id = profile.providerId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    return { ok: false, code: "INVALID_PROVIDER_ID" };
  }
  return {
    ok: true,
    value: {
      profileUrl,
      files: [
        { filename: `oldx-provider-${id}-card.svg`, mimeType: "image/svg+xml", content: cardSvg },
        { filename: `oldx-provider-${id}-qr.svg`, mimeType: "image/svg+xml", content: qrSvg }
      ]
    }
  };
}
