/**
 * OLDX public service provider profile detail view.
 * Presentation only: caller supplies an active public profile and handles
 * contact actions. No direct Firebase writes or untrusted HTML injection.
 */
import { SERVICE_CATEGORIES } from "./profile-form.js";

const categoryLabels = new Map(SERVICE_CATEGORIES.map(item => [item.id, item.label]));
const safeText = value => typeof value === "string" ? value.trim() : "";
const node = (tag, text) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  return result;
};

export function buildServiceProfileShareUrl(profileId, baseUrl) {
  if (typeof profileId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(profileId)) {
    throw new TypeError("Invalid service profile ID");
  }
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Invalid base URL");
  url.searchParams.set("serviceProvider", profileId);
  return url.toString();
}

export function mountPublicServiceProfile(container, {
  profile, baseUrl, onChat, onCall, onWhatsApp
} = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError("Container must be an element");
  if (!profile || profile.status !== "active") {
    container.replaceChildren(node("p", "This service provider profile is not available."));
    return { destroy: () => container.replaceChildren() };
  }
  const section = node("section");
  section.className = "oldx-service-profile";
  section.append(node("h2", safeText(profile.displayName) || "Service provider"));
  section.append(node("p", [safeText(profile.city), safeText(profile.district), "Gujarat"].filter(Boolean).join(", ")));
  if (safeText(profile.description)) section.append(node("p", safeText(profile.description)));
  const categories = Array.isArray(profile.serviceCategories)
    ? profile.serviceCategories.filter(id => categoryLabels.has(id)).map(id => categoryLabels.get(id))
    : [];
  section.append(node("p", categories.join(" · ")));

  const actions = node("div");
  actions.className = "oldx-service-profile-actions";
  function addAction(label, callback) {
    if (typeof callback !== "function") return;
    const button = node("button", label);
    button.type = "button";
    button.addEventListener("click", () => callback(profile));
    actions.append(button);
  }
  // Host app must enforce signed-in checks and blocked-user policy.
  addAction("Chat", onChat);
  addAction("Call", onCall);
  addAction("WhatsApp", onWhatsApp);

  if (typeof profile.id === "string" && profile.id && typeof baseUrl === "string") {
    try {
      const shareUrl = buildServiceProfileShareUrl(profile.id, baseUrl);
      const share = node("button", "Share profile");
      share.type = "button";
      const status = node("p");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      share.addEventListener("click", async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title: safeText(profile.displayName), url: shareUrl });
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            status.textContent = "Profile link copied.";
          } else {
            status.textContent = shareUrl;
          }
        } catch (error) {
          if (error?.name !== "AbortError") status.textContent = "Could not share this profile.";
        }
      });
      actions.append(share, status);
    } catch {
      // Do not render a malformed or unsafe share link.
    }
  }
  section.append(actions);
  container.replaceChildren(section);
  return { destroy: () => section.remove() };
}
