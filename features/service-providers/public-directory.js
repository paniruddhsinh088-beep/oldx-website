/**
 * OLDX Service Providers — public discovery view.
 * Read-only DOM renderer. No Firebase writes or global CSS.
 * Feed it only public, active profiles from listActiveServiceProfiles().
 */
import { SERVICE_CATEGORIES } from "./profile-form.js";

const labels = new Map(SERVICE_CATEGORIES.map(item => [item.id, item.label]));
const text = value => typeof value === "string" ? value.trim() : "";

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

export function filterPublicServiceProfiles(profiles, { category = "", city = "", search = "" } = {}) {
  if (!Array.isArray(profiles)) return [];
  const cityQuery = text(city).toLocaleLowerCase();
  const query = text(search).toLocaleLowerCase();
  return profiles.filter(profile => {
    if (!profile || profile.status !== "active") return false;
    if (category && (!labels.has(category) || !Array.isArray(profile.serviceCategories) || !profile.serviceCategories.includes(category))) return false;
    if (cityQuery && !text(profile.city).toLocaleLowerCase().includes(cityQuery)) return false;
    const haystack = [profile.displayName, profile.description, profile.city, profile.district,
      ...(Array.isArray(profile.serviceCategories) ? profile.serviceCategories.map(id => labels.get(id) || "") : [])]
      .map(text).join(" ").toLocaleLowerCase();
    return !query || haystack.includes(query);
  });
}

export function mountPublicServiceDirectory(container, { profiles = [], onProfileOpen } = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError("Container must be an element");
  const root = element("section", "oldx-service-directory");
  const title = element("h2", "", "Find local service providers");
  const controls = element("div", "oldx-service-filters");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search services or providers";
  search.setAttribute("aria-label", "Search service providers");
  const city = element("input");
  city.type = "search";
  city.placeholder = "City";
  city.setAttribute("aria-label", "Filter by city");
  const category = element("select");
  category.setAttribute("aria-label", "Filter by service");
  const all = element("option", "", "All services");
  all.value = "";
  category.append(all);
  for (const item of SERVICE_CATEGORIES) {
    const option = element("option", "", item.label);
    option.value = item.id;
    category.append(option);
  }
  controls.append(search, city, category);
  const count = element("p");
  count.setAttribute("role", "status");
  count.setAttribute("aria-live", "polite");
  const cards = element("div", "oldx-service-cards");
  root.append(title, controls, count, cards);

  let currentProfiles = profiles;
  function render() {
    const matches = filterPublicServiceProfiles(currentProfiles, {
      search: search.value, city: city.value, category: category.value
    });
    count.textContent = matches.length + (matches.length === 1 ? " provider found" : " providers found");
    cards.replaceChildren();
    if (!matches.length) {
      cards.append(element("p", "", "No service providers match your filters."));
      return;
    }
    for (const profile of matches) {
      const card = element("article", "oldx-service-card");
      const name = element("h3", "", text(profile.displayName) || "Service provider");
      const location = element("p", "", [text(profile.city), text(profile.district)].filter(Boolean).join(", "));
      const description = element("p", "", text(profile.description));
      const services = element("p", "", (Array.isArray(profile.serviceCategories) ? profile.serviceCategories : [])
        .filter(id => labels.has(id)).map(id => labels.get(id)).join(" · "));
      card.append(name, location, description, services);
      if (typeof onProfileOpen === "function" && typeof profile.id === "string" && profile.id) {
        const button = element("button", "", "View profile");
        button.type = "button";
        button.addEventListener("click", () => onProfileOpen(profile.id));
        card.append(button);
      }
      cards.append(card);
    }
  }
  for (const input of [search, city, category]) input.addEventListener("input", render);
  container.replaceChildren(root);
  render();
  return {
    setProfiles(nextProfiles) {
      currentProfiles = Array.isArray(nextProfiles) ? nextProfiles : [];
      render();
    },
    destroy() { root.remove(); }
  };
}
