import { demoProviders } from "./preview-fixtures.mjs";
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
  let rows = demoProviders.filter(
    (p) =>
      (!$("availableOnly").checked || p.available !== false) &&
      (activeCategory === "બધી સેવાઓ" ||
        p.services.some((s) => s.includes(activeCategory))) &&
      (!q ||
        (p.name + " " + p.services.join(" ") + " " + p.about)
          .normalize("NFC")
          .toLocaleLowerCase(translator.locale)
          .includes(q)) &&
      (!area ||
        p.area
          .normalize("NFC")
          .toLocaleLowerCase(translator.locale)
          .includes(area)),
  );
  if (sort === "experience") rows.sort((a, b) => b.experience - a.experience);
  if (sort === "name")
    rows.sort((a, b) => a.name.localeCompare(b.name, translator.locale));
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
      avatar.textContent = p.icon;
      const identity = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = p.name;
      const areaText = document.createElement("div");
      areaText.className = "meta";
      areaText.textContent = p.area;
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
      meta.textContent = t("experienceByProvider", { count: p.experience });
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
        openProfile(p.id);
      });
      foot.append(label, button);
      article.append(top, tags, meta, availability, foot);
      results.append(article);
    });
  }
}
function show(id, restoreResult = false) {
  for (const view of ["browseView", "profileView", "providerView"]) {
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
              : "resultsHeading",
        );
  target.focus();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function openProfile(id) {
  const p = demoProviders.find((x) => x.id === id);
  if (!p) return;
  currentProfile = p;
  $("pName").textContent = p.name;
  $("pArea").textContent = p.area;
  const serviceTags = p.services.map((service) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = service;
    return tag;
  });
  $("pServices").replaceChildren(...serviceTags);
  $("pAbout").textContent = p.about;
  $("pExperience").textContent = t("profileExperienceSummary", {
    count: p.experience,
    area: p.area,
  });
  show("profileView");
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
$("browseTab").addEventListener("click", () => show("browseView"));
$("providerTab").addEventListener("click", () => show("providerView"));
$("backBtn").addEventListener("click", () => show("browseView", true));

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
      count: currentProfile.experience,
      area: currentProfile.area,
    });
  }
  updatePreview();
}
$("localeSelect").addEventListener("change", (event) =>
  selectLocale(event.target.value, true),
);
await selectLocale(readLocalePreference(preferenceStorage(), "gu"));
