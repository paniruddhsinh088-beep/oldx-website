/**
 * Review-only share metadata builder. No network access or publishing.
 * The trusted application must supply its approved HTTPS origin and stable
 * provider ID. This helper does not create OG images or QR codes.
 */
export function buildProviderShareMetadata({ origin, providerId, displayName, city, services } = {}) {
  if (typeof origin !== "string" || typeof providerId !== "string" ||
      typeof displayName !== "string" || typeof city !== "string" ||
      !Array.isArray(services) || services.length < 1 || services.length > 12 ||
      services.some(s => typeof s !== "string" || !s.trim() || s.length > 64)) {
    return { ok: false, code: "INVALID_SHARE_DATA" };
  }
  let base;
  try {
    base = new URL(origin);
  } catch {
    return { ok: false, code: "INVALID_SHARE_ORIGIN" };
  }
  // Only an application-controlled origin is permitted. No credentials, paths,
  // queries, fragments, nonstandard ports or insecure HTTP links.
  if (base.protocol !== "https:" || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash || base.port ||
      !["oldxbazar.in", "www.oldxbazar.in"].includes(base.hostname) ||
      origin !== base.origin) {
    return { ok: false, code: "INVALID_SHARE_ORIGIN" };
  }
  const id = providerId.trim();
  const name = displayName.trim();
  const location = city.trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !name || name.length > 80 ||
      !location || location.length > 80 ||
      [name, location, ...services].some(s => /[<>\u0000-\u001f\u007f]/u.test(s))) {
    return { ok: false, code: "INVALID_SHARE_DATA" };
  }
  const url = new URL("/services/provider/" + encodeURIComponent(id), base).toString();
  return {
    ok: true,
    value: {
      url,
      title: name + " | OLDX Services",
      description: services.map(s => s.trim()).slice(0, 3).join(", ") + " • " + location
    }
  };
}
