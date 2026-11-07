// Only first-party nodes explicitly marked in the template are localized.
// Input values, provider records, routes and arbitrary attributes are untouched.
export function applyCatalog(root, translator) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = translator.t(node.dataset.i18n);
  }
  for (const [attribute, dataKey] of [
    ["placeholder", "i18nPlaceholder"],
    ["aria-label", "i18nAriaLabel"],
    ["title", "i18nTitle"],
  ]) {
    const selector = "[data-i18n-" + attribute + "]";
    for (const node of root.querySelectorAll(selector)) {
      node.setAttribute(attribute, translator.t(node.dataset[dataKey]));
    }
  }
  root.documentElement.lang = translator.locale;
}
