import { demoProviders } from "./preview-fixtures.mjs";
import { inspectProviderPreviewDraft } from "./preview-draft.mjs";

let activeCategory = "બધી સેવાઓ";
let validated = false;
let returnToResult = null;
const $ = (id) => document.getElementById(id);
function render() {
  const q = $("q").value.trim().normalize("NFC").toLocaleLowerCase("gu"),
    area = $("area").value.trim().normalize("NFC").toLocaleLowerCase("gu"),
    sort = $("sort").value;
  let rows = demoProviders.filter(
    (p) =>
      (!$("availableOnly").checked || p.available !== false) &&
      (activeCategory === "બધી સેવાઓ" ||
        p.services.some((s) => s.includes(activeCategory))) &&
      (!q ||
        (p.name + " " + p.services.join(" ") + " " + p.about)
          .toLocaleLowerCase("gu")
          .includes(q)) &&
      (!area || p.area.toLocaleLowerCase("gu").includes(area)),
  );
  if (sort === "experience") rows.sort((a, b) => b.experience - a.experience);
  if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name, "gu"));
  $("resultCount").textContent = rows.length + " ડેમો પ્રોફાઇલ્સ";
  const results = $("results");
  results.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      "આ શોધ માટે ડેમો પ્રોફાઇલ મળી નથી. શબ્દ અથવા વિસ્તાર બદલીને જુઓ.";
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
      meta.textContent =
        p.experience + " વર્ષનો અનુભવ · સેવા આપનારની આપેલી માહિતી";
      const availability = document.createElement("div");
      availability.className = "status";
      availability.textContent =
        p.available === false ? "હાલ વ્યસ્ત (ડેમો)" : "ઉપલબ્ધ (ડેમો)";
      const foot = document.createElement("div");
      foot.className = "provider-foot";
      const label = document.createElement("strong");
      label.textContent = "ડેમો પ્રોફાઇલ";
      const button = document.createElement("button");
      button.className = "btn";
      button.textContent = "પ્રોફાઇલ જુઓ";
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
  $("pExperience").textContent =
    p.experience + " વર્ષનો અનુભવ · " + p.area + " (ડેમો માહિતી)";
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
const errorMessages = {
  displayName:
    "નામ ઉમેરો (મહત્તમ 80 અક્ષર); HTML અથવા નિયંત્રણ અક્ષરો માન્ય નથી.",
  city: "શહેર ઉમેરો (મહત્તમ 80 અક્ષર).",
  serviceArea: "સેવાનો વિસ્તાર ઉમેરો (મહત્તમ 120 અક્ષર).",
  services: "ઓછામાં ઓછી એક અલગ સેવા પસંદ કરો.",
  experienceYears: "અનુભવ 0 થી 80 વચ્ચે પૂર્ણ વર્ષોમાં ઉમેરો અથવા ખાલી રાખો.",
  description:
    "પરિચય મહત્તમ 1200 અક્ષરનો હોવો જોઈએ; HTML અથવા નિયંત્રણ અક્ષરો માન્ય નથી.",
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
  $("previewName").textContent =
    draft.displayName.trim() || "તમારી પ્રોફાઇલનો પ્રિવ્યૂ";
  $("previewArea").textContent =
    [draft.city.trim(), draft.serviceArea.trim()].filter(Boolean).join(" · ") ||
    "શહેર / વિસ્તાર ઉમેરો";
  $("previewServices").textContent = draft.services.length
    ? draft.services.join(" · ")
    : "હજુ કોઈ સેવા પસંદ કરી નથી.";
  $("previewConsent").textContent =
    "ફોન: " +
    (draft.phoneConsent ? "સ્થાનિક પસંદગી ચાલુ" : "જાહેર નથી") +
    " · WhatsApp: " +
    (draft.whatsappConsent ? "સ્થાનિક પસંદગી ચાલુ" : "જાહેર નથી");
  $("previewDescription").textContent = draft.description;
  $("previewExperience").textContent = Number.isNaN(draft.experienceYears)
    ? "અનુભવ માન્ય નથી."
    : draft.experienceYears === ""
      ? "અનુભવ ઉમેરેલો નથી."
      : draft.experienceYears + " વર્ષ";
  $("previewAvailability").textContent = draft.available
    ? "ઉપલબ્ધ (સ્થાનિક પ્રિવ્યૂ)"
    : "હાલ વ્યસ્ત (સ્થાનિક પ્રિવ્યૂ)";
  $("completionText").textContent =
    result.completed + " / " + result.required + " જરૂરી વિગતો તૈયાર";
  for (const [field, id] of Object.entries(fieldIds)) {
    const invalid = validated && Object.hasOwn(result.errors, field);
    $(id).setAttribute("aria-invalid", String(invalid));
    $(id + "Error").textContent = invalid ? errorMessages[field] : "";
  }
  if (validated)
    $("validationStatus").textContent = result.ok
      ? "સ્થાનિક પ્રિવ્યૂ માન્ય છે. કંઈ સેવ કે પ્રકાશિત થયું નથી."
      : "નીચે દર્શાવેલી વિગતો સુધારો. કંઈ સેવ કે પ્રકાશિત થયું નથી.";
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
render();
updatePreview();
