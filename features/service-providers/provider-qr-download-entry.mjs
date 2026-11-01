import { encodeProviderQrSvg } from "./provider-qr-encoder.mjs";
import { handleProviderShareDownloadClick } from "./provider-download-click.mjs";

/**
 * Review-only browser entry point. Call from a real user click.
 * Loads the offline QR package lazily, then prepares and downloads
 * the provider card and QR SVG without any remote QR service.
 *
 * Browser globals are passed explicitly to keep tests isolated.
 */
export async function downloadProviderCardAndQr(profile, browser = {}, qrEncoder = encodeProviderQrSvg, selection = "both") {
  return handleProviderShareDownloadClick(profile, qrEncoder, browser, selection);
}
