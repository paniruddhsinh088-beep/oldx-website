import { demoProviders } from "./preview-fixtures.mjs";
import { buildPublicProviderProfile } from "./provider-public-profile.mjs";
import { parseServicePreviewRoute, buildServicePreviewLink } from "./preview-route.mjs";
import { shareProviderLink } from "./provider-mobile-share.mjs";

import { inspectProviderPreviewDraft } from "./preview-draft.mjs";
import {
  createTranslator,
  loadTranslator,
  SUPPORTED_LOCALES,
} from "../i18n/i18n.mjs";
import { applyCatalog } from "../i18n/dom.mjs";
import {
  readLocalePreference,
  writeLocalePreference,
} from "../i18n/preference.mjs";

// Only explicitly projected synthetic public data reaches rendering/share state.
const publicProfiles = demoProviders.map(provider => buildPublicProviderProfile({
  id: provider.id, displayName: provider.name, city: provider.city,
  serviceArea: provider.area, description: provider.about, services: provider.services,
  available: provider.available !== false, experienceYears: provider.experience
})).filter(result => result.ok).map(result => result.profile);
const demoIcons = new Map(demoProviders.map(provider => [provider.id, provider.icon]));

let translator = createTranslator("en");
const t = (key, params) => translator.t(key, params);
let currentProfile = null;
let localeRequest = 0;
function preferenceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let activeCategory = "બધી સેવાઓ";
let validated = false;
let returnToResult = null;
const $ = (id) => document.getElementById(id);
function render() {
  const q = $("q")
      .value.trim()
      .normalize("NFC")
      .toLocaleLowerCase(translator.locale),
    area = $("area")
      .value.trim()
      .normalize("NFC")
      .toLocaleLowerCase(translator.locale),
    sort = $("sort").value;
  let rows = publicProfiles.filter(
    (p) =>
      (!$("availableOnly").checked || p.available !== false) &&
      (activeCategory === "બધી સેવાઓ" ||
        p.services.some((s) => s.includes(activeCategory))) &&
      (!q ||
        (p.displayName + " " + p.services.join(" ") + " " + p.description)
          .normalize("NFC")
          .toLocaleLowerCase(translator.locale)
          .includes(q)) &&
      (!area ||
        p.serviceArea
          .normalize("NFC")
          .toLocaleLowerCase(translator.locale)
          .includes(area)),
  );
  if (sort === "experience") rows.sort((a, b) => b.experienceYears - a.experienceYears);
  if (sort === "name")
    rows.sort((a, b) => a.displayName.localeCompare(b.displayName, translator.locale));
  $("resultCount").textContent = t("resultCount", { count: rows.length });
  const results = $("results");
  results.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("emptyResults");
    results.append(empty);
  } else {
    rows.forEach((p) => {
      const article = document.createElement("article");
      article.className = "provider";
      const top = document.createElement("div");
      top.className = "provider-top";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = demoIcons.get(p.id) || "🧑‍🔧";
      const identity = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = p.displayName;
      const areaText = document.createElement("div");
      areaText.className = "meta";
      areaText.textContent = p.serviceArea;
      identity.append(name, areaText);
      top.append(avatar, identity);
      const tags = document.createElement("div");
      tags.className = "tags";
      p.services.forEach((service) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = service;
        tags.append(tag);
      });
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = t("experienceByProvider", { count: p.experienceYears });
      const availability = document.createElement("div");
      availability.className = "status";
      availability.textContent = t(
        p.available === false ? "busyDemo" : "availableDemo",
      );
      const foot = document.createElement("div");
      foot.className = "provider-foot";
      const label = document.createElement("strong");
      label.textContent = t("demoProfile");
      const button = document.createElement("button");
      button.className = "btn";
      button.dataset.providerId = p.id;
      button.textContent = t("viewProfile");
      button.addEventListener("click", () => {
        returnToResult = button;
        navigate("#provider/" + p.id);
      });
      foot.append(label, button);
      article.append(top, tags, meta, availability, foot);
      results.append(article);
    });
  }
}
function show(id, restoreResult = false, focus = true) {
  for (const view of ["browseView", "profileView", "providerView", "notFoundView"]) {
    $(view).classList.toggle("active", view === id);
    $(view).hidden = view !== id;
  }
  $("browseTab").setAttribute(
    "aria-current",
    id === "providerView" ? "false" : "page",
  );
  $("providerTab").setAttribute(
    "aria-current",
    id === "providerView" ? "page" : "false",
  );
  const target =
    restoreResult && returnToResult?.isConnected
      ? returnToResult
      : $(
          id === "profileView"
            ? "pName"
            : id === "providerView"
              ? "providerHeading"
              : id === "notFoundView" ? "notFoundHeading" : "resultsHeading",
        );
  if (focus) { target.focus(); window.scrollTo({ top: 0, behavior: "instant" }); }
}
function openProfile(id, focus = true) {
  const p = publicProfiles.find((x) => x.id === id);
  if (!p) return false;
  currentProfile = p;
  $("pName").textContent = p.displayName;
  $("pArea").textContent = p.serviceArea;
  const serviceTags = p.services.map((service) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = service;
    return tag;
  });
  $("pServices").replaceChildren(...serviceTags);
  $("pAbout").textContent = p.description;
  $("pExperience").textContent = t("profileExperienceSummary", {
    count: p.experienceYears,
    area: p.serviceArea,
  });
  prepareProfileLink();
  show("profileView", false, focus);
  return true;
}
$("categories").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  activeCategory = b.dataset.cat;
  document.querySelectorAll(".chip").forEach((x) => {
    x.classList.toggle("active", x === b);
    x.setAttribute("aria-pressed", String(x === b));
  });
  render();
});
$("searchBtn").addEventListener("click", render);
$("q").addEventListener("input", render);
$("area").addEventListener("input", render);
$("sort").addEventListener("change", render);
$("browseTab").addEventListener("click", () => navigate("#services"));
$("providerTab").addEventListener("click", () => navigate("#my-services"));
$("backBtn").addEventListener("click", () => navigate("#services", true));

const fieldIds = {
  displayName: "providerName",
  city: "providerCity",
  serviceArea: "providerArea",
  services: "serviceOptions",
  experienceYears: "providerExp",
  description: "providerDesc",
};
function readDraft() {
  return {
    displayName: $("providerName").value,
    city: $("providerCity").value,
    serviceArea: $("providerArea").value,
    experienceYears: $("providerExp").validity.badInput
      ? NaN
      : $("providerExp").value,
    description: $("providerDesc").value,
    services: [
      ...document.querySelectorAll("#serviceOptions input:checked"),
    ].map((input) => input.value),
    available: $("providerAvailable").checked,
    phoneConsent: $("allowPhone").checked,
    whatsappConsent: $("allowWhatsapp").checked,
  };
}
function updatePreview() {
  const draft = readDraft();
  const result = inspectProviderPreviewDraft(draft);
  $("previewName").textContent = draft.displayName.trim() || t("previewTitle");
  $("previewArea").textContent =
    [draft.city.trim(), draft.serviceArea.trim()].filter(Boolean).join(" · ") ||
    t("previewAreaEmpty");
  $("previewServices").textContent = draft.services.length
    ? draft.services.join(" · ")
    : t("previewServicesEmpty");
  $("previewConsent").textContent = t("previewConsent", {
    phone: t(draft.phoneConsent ? "consentOn" : "consentOff"),
    whatsapp: t(draft.whatsappConsent ? "consentOn" : "consentOff"),
  });
  $("previewDescription").textContent = draft.description;
  $("previewExperience").textContent = Number.isNaN(draft.experienceYears)
    ? t("experienceInvalid")
    : draft.experienceYears === ""
      ? t("experienceEmpty")
      : t("experienceYears", { count: Number(draft.experienceYears) });
  $("previewAvailability").textContent = t(
    draft.available ? "availablePreview" : "busyPreview",
  );
  $("completionText").textContent = t("completion", {
    completed: result.completed,
    required: result.required,
  });
  for (const [field, id] of Object.entries(fieldIds)) {
    const invalid = validated && Object.hasOwn(result.errors, field);
    $(id).setAttribute("aria-invalid", String(invalid));
    $(id + "Error").textContent = invalid ? t("error." + field) : "";
  }
  if (validated)
    $("validationStatus").textContent = result.ok
      ? t("validationValid")
      : t("validationInvalid");
  return result;
}
$("providerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  validated = true;
  const result = updatePreview();
  const field = Object.keys(fieldIds).find((key) =>
    Object.hasOwn(result.errors, key),
  );
  if (field) {
    const element = $(fieldIds[field]);
    (field === "services" ? element.querySelector("input") : element).focus();
  } else $("validationStatus").focus();
});
$("providerForm").addEventListener("input", updatePreview);
$("availableOnly").addEventListener("change", render);
$("resetSearch").addEventListener("click", () => {
  $("q").value = "";
  $("area").value = "";
  $("sort").value = "relevance";
  $("availableOnly").checked = false;
  activeCategory = "બધી સેવાઓ";
  document.querySelectorAll(".chip").forEach((button) => {
    const selected = button.dataset.cat === activeCategory;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  render();
  $("q").focus();
});

async function selectLocale(requested, persist = false) {
  const request = ++localeRequest;
  let next,
    failed = false;
  try {
    next = await loadTranslator(requested);
  } catch {
    next = createTranslator("en");
    failed = true;
  }
  // A slower earlier catalog must never replace a later language selection.
  if (request !== localeRequest) return;
  translator = next;
  applyCatalog(document, translator);
  $("localeSelect").value = translator.locale;
  $("localeStatus").textContent = failed
    ? t("languageUnavailable")
    : t("languageChanged", {
        language: SUPPORTED_LOCALES.find(
          (item) => item.code === translator.locale,
        ).name,
      });
  if (persist && !failed)
    writeLocalePreference(preferenceStorage(), translator.locale);
  const previousProviderId = returnToResult?.dataset.providerId;
  render();
  returnToResult =
    [...document.querySelectorAll("#results article button")].find(
      (button) => button.dataset.providerId === previousProviderId,
    ) || null;
  if (currentProfile) {
    $("pExperience").textContent = t("profileExperienceSummary", {
      count: currentProfile.experienceYears,
      area: currentProfile.serviceArea,
    });
  }
  if (feedbackKey) $("profileShareStatus").textContent = t(feedbackKey);
  updatePreview();
}
$("localeSelect").addEventListener("change", (event) =>
  selectLocale(event.target.value, true),
);
let renderedHash = null;
let routeRevision = 0;
let feedbackKey = null;
function prepareProfileLink() {
  const link = currentProfile && buildServicePreviewLink({
    pageUrl: window.location.href, origin: window.location.origin, providerId: currentProfile.id
  });
  $("profileLink").value = link?.ok ? link.url : "";
  $("copyProfileLink").disabled = $("shareProfileLink").disabled = !link?.ok;
  if (!link?.ok) $("profileShareStatus").textContent = t("previewShareUnavailable");
}
function clearProfile(erase = false) {
  currentProfile = null; feedbackKey = null;
  $("profileLink").value = ""; $("profileShareStatus").textContent = "";
  $("copyProfileLink").disabled = $("shareProfileLink").disabled = true;
  if (erase) {
    for (const id of ["pName", "pArea", "pAbout", "pExperience"]) $(id).textContent = "";
    $("pServices").replaceChildren();
  }
}
function syncRoute({ focus = true, restoreResult = false, force = false } = {}) {
  if (!force && renderedHash === window.location.hash) return;
  const previous = renderedHash;
  renderedHash = window.location.hash; routeRevision++;
  clearProfile();
  const route = parseServicePreviewRoute(renderedHash);
  if (route.view === "profile" && openProfile(route.providerId, focus)) return;
  if (route.view === "browse") show("browseView", restoreResult || previous?.startsWith("#provider/"), focus);
  else if (route.view === "provider") show("providerView", false, focus);
  else { clearProfile(true); show("notFoundView", false, focus); }
}
function navigate(hash, restoreResult = false) {
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  syncRoute({ restoreResult, force: true });
}
async function shareCurrentProfile(copyOnly) {
  if (!currentProfile || !$("profileLink").value) return;
  const revision = routeRevision;
  const data = { title: t("previewShareTitle", { name: currentProfile.displayName }),
    text: t("previewShareText"), url: $("profileLink").value };
  $("copyProfileLink").disabled = $("shareProfileLink").disabled = true;
  $("profileShareStatus").textContent = t("previewSharePending");
  const result = await shareProviderLink(data, {
    share: !copyOnly && typeof navigator.share === "function" ? value => navigator.share(value) : undefined,
    writeText: navigator.clipboard && typeof navigator.clipboard.writeText === "function"
      ? value => navigator.clipboard.writeText(value) : undefined
  });
  if (revision !== routeRevision || !currentProfile) return;
  feedbackKey = result.ok ? (result.method === "clipboard" ? "previewLinkCopied" : "previewShareOpened")
    : result.code === "SHARE_CANCELLED" ? "previewShareCancelled" : "previewShareUnavailable";
  $("profileShareStatus").textContent = t(feedbackKey);
  prepareProfileLink();
}
$("copyProfileLink").addEventListener("click", () => shareCurrentProfile(true));
$("shareProfileLink").addEventListener("click", () => shareCurrentProfile(false));
$("notFoundBack").addEventListener("click", () => navigate("#services"));
window.addEventListener("popstate", () => syncRoute());
window.addEventListener("hashchange", () => syncRoute());
await selectLocale(readLocalePreference(preferenceStorage(), "gu"));
syncRoute({ focus: false });
