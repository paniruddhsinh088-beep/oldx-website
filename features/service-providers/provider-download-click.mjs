import { downloadProviderShareAssets } from "./provider-browser-download.mjs";

/**
 * Bind this function to an explicit user click on a preview/review page.
 * Do not auto-run on page load. This does not touch production data.
 */
export async function handleProviderShareDownloadClick(profile, qrEncoder, env = {}, selection = "both") {
  const { Blob: BlobCtor, URL: UrlApi, document: doc } = env;
  if (typeof BlobCtor !== "function" || !UrlApi ||
      typeof UrlApi.createObjectURL !== "function" ||
      typeof UrlApi.revokeObjectURL !== "function" ||
      !doc || typeof doc.createElement !== "function") {
    return { ok: false, code: "BROWSER_APIS_UNAVAILABLE" };
  }
  return downloadProviderShareAssets(profile, qrEncoder, {
    createBlob: (content, mimeType) => new BlobCtor([content], { type: mimeType }),
    createObjectURL: blob => UrlApi.createObjectURL(blob),
    revokeObjectURL: url => UrlApi.revokeObjectURL(url),
    download: (url, filename) => {
      const link = doc.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      link.style.display = "none";
      const parent = doc.body;
      if (!parent || typeof parent.appendChild !== "function") {
        throw new Error("document body unavailable");
      }
      parent.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    }
  }, selection);
}
