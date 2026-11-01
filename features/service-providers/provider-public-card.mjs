/**
 * Review-only buyer-facing service provider card formatter.
 * Call with server-approved public fields only; never pass full user documents.
 * No persistence, network, phone disclosure or authorization decisions.
 */
export function buildPublicProviderCard(provider) {
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    return { ok: false, code: "INVALID_PUBLIC_PROVIDER" };
  }
  const { id, displayName, city, serviceArea, services, available, experienceYears } = provider;
  const validText = (s, max) => typeof s === "string" && s.trim().length > 0 &&
    s.trim().length <= max && !/[<>\u0000-\u001f\u007f]/u.test(s);
  if (!validText(id, 128) || !validText(displayName, 80) ||
      !validText(city, 80) || !validText(serviceArea, 120) ||
      !Array.isArray(services) || services.length < 1 || services.length > 12 ||
      services.some(s => !validText(s, 64)) || typeof available !== "boolean" ||
      (experienceYears !== null && experienceYears !== undefined &&
        (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80))) {
    return { ok: false, code: "INVALID_PUBLIC_PROVIDER" };
  }
  // Explicitly project only public fields; never leak private phone, exact coordinates,
  // email, owner UID, admin data, or unverified review/verification claims.
  return {
    ok: true,
    card: {
      id: id.trim(),
      displayName: displayName.trim(),
      city: city.trim(),
      serviceArea: serviceArea.trim(),
      services: services.map(s => s.trim()),
      available,
      experienceYears: experienceYears ?? null
    }
  };
}
