import { prepareProviderShareDownloads } from "./provider-share-download.mjs";

/**
 * Browser-only download adapter. Invoke from a user's click handler.
 * Dependencies are injected so synthetic tests can run without a browser.
 * No Firebase, remote QR service, storage upload or automatic download.
 */
export async function downloadProviderShareAssets(profile, qrEncoder, browser, selection = "both") {
  if (!browser || typeof browser.createBlob !== "function" ||
      typeof browser.createObjectURL !== "function" ||
      typeof browser.revokeObjectURL !== "function" ||
      typeof browser.download !== "function") {
    return { ok: false, code: "DOWNLOAD_UNAVAILABLE" };
  }
  if (!["both", "card", "qr"].includes(selection)) return { ok: false, code: "INVALID_DOWNLOAD_SELECTION" };
  const prepared = await prepareProviderShareDownloads(profile, qrEncoder);
  if (!prepared.ok) return prepared;
  let downloaded = 0;
  const files = prepared.value.files.filter(file => selection === "both" || file.filename.endsWith(selection === "card" ? "-card.svg" : "-qr.svg"));
  for (const file of files) {
    let objectUrl;
    try {
      const blob = browser.createBlob(file.content, file.mimeType);
      objectUrl = browser.createObjectURL(blob);
      await browser.download(objectUrl, file.filename);
      downloaded++;
    } catch {
      return { ok: false, code: "DOWNLOAD_FAILED", downloaded };
    } finally {
      if (objectUrl !== undefined) browser.revokeObjectURL(objectUrl);
    }
  }
  return { ok: true, downloaded, profileUrl: prepared.value.profileUrl };
}
