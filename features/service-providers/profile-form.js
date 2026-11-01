/**
 * OLDX service provider profile form (isolated UI module).
 * No Firebase writes or production integration occur in this module.
 * Host page can import { mountServiceProviderForm } from this file.
 */
export const SERVICE_CATEGORIES = Object.freeze([
  { id: "carpenter", label: "Carpenter" },
  { id: "mason", label: "Mason" },
  { id: "electrician", label: "Electrician" },
  { id: "plumber", label: "Plumber" },
  { id: "painter", label: "Painter" },
  { id: "cleaning", label: "Cleaning" },
  { id: "appliance-repair", label: "Appliance repair" }
]);

const clean = value => typeof value === "string" ? value.trim() : "";

export function validateServiceProviderProfile(raw) {
  const errors = {};
  const displayName = clean(raw?.displayName);
  const description = clean(raw?.description);
  const city = clean(raw?.city);
  const district = clean(raw?.district);
  const allowed = new Set(SERVICE_CATEGORIES.map(category => category.id));
  const categories = Array.isArray(raw?.serviceCategories)
    ? [...new Set(raw.serviceCategories)]
    : [];
  if (displayName.length < 2 || displayName.length > 80) errors.displayName = "Enter a name (2–80 characters).";
  if (description.length > 1000) errors.description = "Description must be under 1,000 characters.";
  if (!city || city.length > 80) errors.city = "Enter a valid city.";
  if (!district || district.length > 80) errors.district = "Enter a valid district.";
  if (!categories.length || categories.length > 7 || categories.some(id => !allowed.has(id))) {
    errors.serviceCategories = "Select at least one valid service.";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { displayName, description, city, district, state: "Gujarat", serviceCategories: categories }
  };
}

export function mountServiceProviderForm(container, { onSubmit } = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError("Container must be an element");
  const form = document.createElement("form");
  const title = document.createElement("h2");
  title.textContent = "Create your service profile";
  form.append(title);
  const fields = {};
  for (const [name, label, maxLength] of [
    ["displayName", "Your name", 80],
    ["description", "About your services", 1000],
    ["city", "City", 80],
    ["district", "District", 80]
  ]) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = name === "description" ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    input.maxLength = maxLength;
    input.required = name !== "description";
    wrapper.append(input);
    form.append(wrapper);
    fields[name] = input;
  }
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Services offered (choose multiple)";
  fieldset.append(legend);
  for (const category of SERVICE_CATEGORIES) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "serviceCategories";
    input.value = category.id;
    label.append(input, document.createTextNode(category.label));
    fieldset.append(label);
  }
  form.append(fieldset);
  const feedback = document.createElement("p");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  form.append(feedback);
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Continue";
  form.append(button);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const raw = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
    raw.serviceCategories = [...fieldset.querySelectorAll("input:checked")].map(input => input.value);
    const result = validateServiceProviderProfile(raw);
    if (!result.valid) {
      feedback.textContent = Object.values(result.errors).join(" ");
      return;
    }
    if (typeof onSubmit !== "function") {
      feedback.textContent = "Profile validated. Saving is not yet enabled.";
      return;
    }
    button.disabled = true;
    try {
      await onSubmit(result.value);
      feedback.textContent = "Profile submitted.";
    } catch {
      feedback.textContent = "Could not submit profile. Please try again.";
    } finally {
      button.disabled = false;
    }
  });
  container.replaceChildren(form);
  return { form, destroy: () => form.remove() };
}
