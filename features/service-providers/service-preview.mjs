import {createProviderFirebaseSessionPorts} from './firebase-session-ports.mjs';
import {mountWebsiteProviderPhotos} from './website-photos.mjs';
import {mountProviderUiIntegration} from './ui-integration-dom.mjs';
import { inspectSampleEnquiry } from './preview-enquiry.mjs';
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
const websiteMode=new URL(location.href).searchParams.get('mode')==='website';
let websitePhotos=null,websiteFirebase=null;
let publicProfiles = (websiteMode?[]:demoProviders).map(provider => buildPublicProviderProfile({
  id: provider.id, displayName: provider.name, city: provider.city,
  serviceArea: provider.area, description: provider.about, services: provider.services,
  available: provider.available !== false, experienceYears: provider.experience
})).filter(result => result.ok).map(result => result.profile);
const demoIcons = new Map(demoProviders.map(provider => [provider.id, provider.icon]));

let providerIntegration=null,providerIntegrationEnabled=false,restoredProviderLanguages=[],trustedCatalog=null,trustedCursor=null,trustedPublicationEpoch=0,discoveryTimer=null,trustedOptions={};
let translator = createTranslator("en");
const websiteKeys={pageTitle:'website.title',demoNotice:'website.notice',formNotice:'website.formNotice',footerNotice:'website.footer',providerTab:'website.register',emptyResults:'website.unavailable',previewNotFoundHeading:'website.notFound',previewNotFoundDescription:'website.unavailable',previewNotFoundBack:'browseTab',validateButton:'website.validate'};
const t = (key, params) => translator.t(websiteMode?(websiteKeys[key]??key):key, params);
let currentProfile = null;
let enquiryPreview = null, enquiryValidated = false;
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
        (p.serviceArea+' '+(providerIntegrationEnabled?p.city:''))
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
  $('enquiryService').replaceChildren(...p.services.map(service=>{const option=document.createElement('option');option.value=service;option.textContent=service;return option;}));
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
$("searchBtn").addEventListener("click",()=>providerIntegrationEnabled?refreshDiscovery():render());
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
    $("validationStatus").textContent = websiteMode&&result.ok&&!websitePhotos?.hasProfile()?t("website.photoRequired"):result.ok
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
  } else if(websiteMode&&!websitePhotos?.hasProfile())document.querySelector("#websiteProviderPhotos input").focus();
  else $("validationStatus").focus();
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
  applyCatalog(document, {...translator,t});
  websitePhotos?.render();
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
  renderSampleEnquiry();
  updatePreview();
  const enquiry=providerIntegrationEnabled&&currentProfile?{providerId:currentProfile.id,...readSampleEnquiry()}:null;
  providerIntegration?.render();
  if(enquiry&&currentProfile?.id===enquiry.providerId){$('enquiryService').value=enquiry.service;$('enquiryDescription').value=enquiry.description;$('enquiryTiming').value=enquiry.timing;renderSampleEnquiry();}
  if(providerIntegrationEnabled)$('trustedEnquiryStatus').textContent=t('market.provider.enquiry_'+providerIntegration.buyer.snapshot().status);
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
  if(providerIntegrationEnabled){$('trustedEnquiryLink').hidden=true;$('trustedEnquiryStatus').textContent='';}
  resetSampleEnquiry(true);
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
  clearTimeout(discoveryTimer);
  const previous = renderedHash;
  renderedHash = window.location.hash; routeRevision++;
  providerIntegration?.changeScope();
  clearProfile(providerIntegrationEnabled);
  const route = parseServicePreviewRoute(renderedHash);
  if(providerIntegrationEnabled&&route.view==='profile'){show("profileView",false,focus);return providerIntegration.model.detail({providerId:route.providerId,expectedGeneration:null});}
  if (route.view === "profile" && openProfile(route.providerId, focus)) return;
  if (route.view === "browse") {show("browseView", restoreResult || previous?.startsWith("#provider/"), focus);if(providerIntegrationEnabled)return refreshDiscovery();}
  else if (route.view === "provider") show("providerView", false, focus);
  else { clearProfile(true); show("notFoundView", false, focus); }
}
function navigate(hash, restoreResult = false) {
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  return syncRoute({ restoreResult, force: true });
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
function readSampleEnquiry() {
  return {service:$('enquiryService').value,description:$('enquiryDescription').value,timing:$('enquiryTiming').value};
}
function renderSampleEnquiry() {
  const result=currentProfile?inspectSampleEnquiry(currentProfile,readSampleEnquiry()):{ok:false,fields:[]};
  const invalid=enquiryValidated && !result.ok;
  for(const [field,id] of [['service','enquiryService'],['description','enquiryDescription'],['timing','enquiryTiming']]) $(id).setAttribute('aria-invalid',String(invalid && result.fields.includes(field)));
  $('enquiryError').textContent=invalid?t('enquiry.error'):'';
  $('enquirySummary').hidden=!enquiryPreview;
  $('enquiryChosenService').textContent=enquiryPreview?.service??'';
  $('enquiryChosenDescription').textContent=enquiryPreview?.description??'';
  $('enquiryChosenTiming').textContent=enquiryPreview?t(enquiryPreview.timing==='this-week'?'enquiry.thisWeek':'enquiry.flexible'):'';
}
function resetSampleEnquiry(removeOptions=false) {
  enquiryPreview=null;enquiryValidated=false;
  $('enquiryDescription').value='';$('enquiryTiming').value='flexible';
  if(removeOptions)$('enquiryService').replaceChildren();else $('enquiryService').selectedIndex=0;
  renderSampleEnquiry();
}
$('sampleEnquiryForm').addEventListener('submit',event=>{
  event.preventDefault();if(providerIntegrationEnabled){if(!currentProfile||trustedPublicationEpoch<1)return;const state=providerIntegration.buyer.snapshot();if(state.canRetry||state.status==='loading')return;providerIntegration.buyer.select({providerId:currentProfile.id,services:[...currentProfile.services],publicationGeneration:trustedPublicationEpoch});providerIntegration.buyer.create(readSampleEnquiry());return;}enquiryValidated=true;
  const result=inspectSampleEnquiry(currentProfile,readSampleEnquiry());
  enquiryPreview=result.ok?result.value:null;renderSampleEnquiry();
  if(result.ok)$('enquirySummary').focus();
  else $(result.fields[0]==='service'?'enquiryService':result.fields[0]==='description'?'enquiryDescription':'enquiryTiming').focus();
});
$('sampleEnquiryForm').addEventListener('input',()=>{enquiryPreview=null;renderSampleEnquiry();});
$('cancelSampleEnquiry').addEventListener('click',()=>{resetSampleEnquiry();$('enquiryService').focus();});
window.addEventListener('pagehide',()=>resetSampleEnquiry());
window.addEventListener('pageshow',event=>{if(event.persisted)resetSampleEnquiry();});

function refreshDiscovery(cursor=null){
 if(!providerIntegrationEnabled)return;clearTimeout(discoveryTimer);const raw=$('area').value.trim();let locality=raw;
 if(raw&&trustedCatalog?.localities){const exact=trustedCatalog.localities.filter(l=>l.serviceArea===raw),city=trustedCatalog.localities.filter(l=>l.city===raw);if(exact.length===1)locality=exact[0].serviceArea;else if(city.length===1)locality=city[0].serviceArea;else {providerIntegration.changeScope();publicProfiles=[];clearProfile(true);render();$('providerPublicStatus').textContent=t('market.provider.chooseArea');return;}}
 const typed=$('q').value.trim(),category=trustedCatalog?.services?.includes(typed)?typed:activeCategory==='બધી સેવાઓ'?'':activeCategory;
 return providerIntegration.model.discover({category,locality,limit:12,cursor});
}
function queueDiscovery(){if(!providerIntegrationEnabled)return;clearTimeout(discoveryTimer);if(parseServicePreviewRoute(location.hash).view==='browse')discoveryTimer=setTimeout(()=>{if(parseServicePreviewRoute(location.hash).view==='browse')refreshDiscovery();},180);}
$('nextProviderPage').addEventListener('click',()=>trustedCursor&&refreshDiscovery(trustedCursor));
$('retryProviderRead').addEventListener('click',()=>syncRoute({force:true}));
$('retryTrustedEnquiry').addEventListener('click',()=>providerIntegration?.buyer.retry());
$('trustedEnquiryLink').addEventListener('click',event=>{if(providerIntegrationEnabled){event.preventDefault();const state=providerIntegration.buyer.snapshot();if(currentProfile&&state.enquiryId)trustedOptions.openPrivateEnquiry?.({providerId:currentProfile.id,enquiryId:state.enquiryId});}});
window.addEventListener('pagehide',()=>clearTimeout(discoveryTimer));
// Future approved host supplies ports/session; default mounts disabled only.
export function configureProviderIntegration(options={}){
 trustedOptions=options;trustedCatalog=options.catalog??null;providerIntegrationEnabled=options.enabled===true;if(websiteMode&&!providerIntegrationEnabled){publicProfiles=[];clearProfile(true);render();}clearTimeout(discoveryTimer);trustedCursor=null;trustedPublicationEpoch=0;
 $('providerPublicStatus').hidden=$('trustedProviderPublicControls').hidden=$('trustedEnquiryStatus').hidden=$('retryTrustedEnquiry').hidden=!providerIntegrationEnabled;
 if(providerIntegrationEnabled){publicProfiles=[];clearProfile(true);$('results').replaceChildren();if(trustedCatalog?.services){$('categories').replaceChildren();for(const service of ['બધી સેવાઓ',...trustedCatalog.services]){const button=document.createElement('button');button.type='button';button.className='chip';button.dataset.cat=service;button.textContent=service==='બધી સેવાઓ'?t('serviceAll'):(options.categoryLabel?.(service,translator.locale)??service);button.setAttribute('aria-pressed',String(service===activeCategory));$('categories').append(button);}}}
 providerIntegration=mountProviderUiIntegration({...options,root:document,managedRoutes:true,translate:t,onSearchScope:queueDiscovery,buyer:{...options.buyer,onChange:state=>{if(providerIntegrationEnabled){$('trustedEnquiryStatus').textContent=t('market.provider.enquiry_'+state.status);$('retryTrustedEnquiry').disabled=!state.canRetry;$('enquiryDescription').readOnly=state.canRetry||state.status==='loading';$('sampleEnquiryForm').querySelector('button[type=submit]').disabled=state.canRetry||state.status==='loading';$('trustedEnquiryLink').hidden=state.status!=='created'||typeof options.openPrivateEnquiry!=='function';if(state.status==='created')$('trustedEnquiryLink').href='#inbox/'+currentProfile?.id+'/enquiry/'+state.enquiryId;}options.buyer?.onChange?.(state);}},
  readProfile:()=>{validated=true;const inspected=updatePreview();return inspected.ok?{...inspected.profile,languages:[...restoredProviderLanguages]}:null;},
  clearPrivateForm:()=>{websitePhotos?.clear();restoredProviderLanguages=[];document.querySelectorAll('[data-owner-restored]').forEach(node=>node.remove());$('providerForm').reset();validated=false;updatePreview();},
  restorePrivateForm:profile=>{
   document.querySelectorAll('[data-owner-restored]').forEach(node=>node.remove());
   for(const [key,id] of Object.entries({displayName:'providerName',city:'providerCity',serviceArea:'providerArea',description:'providerDesc'}))$(id).value=profile[key];
   $('providerExp').value=profile.experienceYears??'';$('providerAvailable').checked=profile.available;$('allowPhone').checked=$('allowWhatsapp').checked=false;restoredProviderLanguages=[...profile.languages];
   const inputs=[...document.querySelectorAll('#serviceOptions input')];inputs.forEach(input=>input.checked=profile.services.includes(input.value));
   for(const service of profile.services){if(inputs.some(input=>input.value===service))continue;const label=document.createElement('label');label.className='check';label.dataset.ownerRestored='true';const input=document.createElement('input');input.type='checkbox';input.value=service;input.checked=true;label.append(input,document.createTextNode(service));$('serviceOptions').append(label);}
   validated=false;updatePreview();
  },
  onPublicState:state=>{
   clearProfile(true);trustedCursor=state.nextCursor??null;trustedPublicationEpoch=state.publicationEpoch??0;$('nextProviderPage').disabled=!trustedCursor;$('providerPublicStatus').textContent=t('integration.read_'+state.status);
   publicProfiles=state.status==='ready'?(state.items??[state.profile]):[];
   if(state.status==='ready'&&state.profile){openProfile(state.profile.id,false);return;}
   render();if(state.status!=='ready'){const message=document.createElement('p');message.setAttribute('role','status');message.textContent=t('integration.read_'+state.status);$('results').replaceChildren(message);$('profileShareStatus').textContent=message.textContent;}
  }
 });const binding=providerIntegration;return Object.freeze({...binding,setSession(value){binding.setSession(value);if(providerIntegrationEnabled)syncRoute({force:true,focus:false});},restoreRoute:()=>syncRoute({force:true}),discover:()=>navigate('#services'),detail:request=>navigate('#provider/'+request.providerId),async openEnquiry(providerId){await navigate('#provider/'+providerId);if(currentProfile?.id===providerId)$('enquiryService').focus();},changeScope:()=>binding.changeScope()});
}
// Explicit source-only composition: the host supplies its EXISTING Auth instance
// and approved server transport/public repository. No automatic live bootstrap.
export function configureWebsiteProviderFirebase({enabled=false,auth,sendCommand,reads,catalog,...options}={}){
 websiteFirebase?.destroy();websiteFirebase=null;
 const ready=websiteMode&&enabled===true&&auth?.app?.options?.projectId==='oldx-staging'&&typeof sendCommand==='function'&&typeof reads?.discover==='function'&&typeof reads?.detail==='function';
 let binding=null,session=null;
 const ports=createProviderFirebaseSessionPorts({enabled:ready,auth,sendCommand,onSession:value=>{session=value;binding?.setSession(value);}});
 binding=configureProviderIntegration({...options,enabled:ready,catalog,reads:ready?reads:undefined,commands:ports.commands,owner:ports.owner,buyer:{...options.buyer,commands:ports.commands}});
 binding.setSession(session);
 websiteFirebase=Object.freeze({...binding,destroy(){ports.destroy();binding.destroy();}});
 return websiteFirebase;
}
if(websiteMode){
 const back=document.createElement('a');back.href='./index.html';back.className='btn';back.textContent='OLDX';document.querySelector('.nav-actions').prepend(back);
 for(const a of document.querySelectorAll('a[href*="service-inbox-preview"],a[href*="service-discovery-preview"]'))a.hidden=true;
 $('sampleEnquiryForm').querySelector('button[type=submit]').disabled=true;
 websitePhotos=mountWebsiteProviderPhotos({root:document,translate:t,onChange:()=>updatePreview()});
}
configureProviderIntegration();
await selectLocale(readLocalePreference(preferenceStorage(), "gu"));
syncRoute({ focus: false });
