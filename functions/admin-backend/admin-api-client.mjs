const ENDPOINTS = Object.freeze({
  "dashboard.summary": { method: "GET", path: "/dashboard" },
  "products.list": { method: "GET", path: "/products" },
  "users.list": { method: "GET", path: "/users" },
  "stores.list": { method: "GET", path: "/stores" },
  "reports.list": { method: "GET", path: "/reports" },
  "audit.list": { method: "GET", path: "/audit" },
  "users.case.read": { method: "GET", path: "/users/case" },
  "users.case.products.list": { method: "GET", path: "/users/case/products" }
});

export class AdminApiError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
  }
}

function safeQuery(query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new AdminApiError("INVALID_QUERY");
  }
  const allowed = new Set(["pageSize", "pageToken", "q", "status", "targetType", "targetId", "caseId", "reason"]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key)) throw new AdminApiError("UNSUPPORTED_QUERY_PARAMETER");
    if (value == null || value === "") continue;
    if (typeof value !== "string" && typeof value !== "number") throw new AdminApiError("INVALID_QUERY");
    params.set(key, String(value));
  }
  return params.toString();
}

/**
 * Small same-origin Admin API client. It deliberately has no Firestore fallback.
 * getIdToken must return a fresh Firebase ID token or null.
 */
export function createAdminApiClient({ getIdToken, fetchImpl = globalThis.fetch, basePath = "/api/admin" } = {}) {
  if (typeof getIdToken !== "function" || typeof fetchImpl !== "function") {
    throw new TypeError("Admin API client requires getIdToken and fetchImpl.");
  }
  if (basePath !== "/api/admin") {
    throw new TypeError("Admin API base path is fixed.");
  }

  return Object.freeze({
    async request(operation, query = {}) {
      const endpoint = ENDPOINTS[operation];
      if (!endpoint) throw new AdminApiError("UNSUPPORTED_OPERATION", 403);
      if (endpoint.method !== "GET") throw new AdminApiError("UNSUPPORTED_METHOD");
      const token = await getIdToken();
      if (typeof token !== "string" || token.length === 0) throw new AdminApiError("AUTH_REQUIRED", 401);

      const queryString = safeQuery(query);
      const url = basePath + endpoint.path + (queryString ? "?" + queryString : "");
      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: "Bearer " + token, Accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error"
        });
      } catch {
        throw new AdminApiError("NETWORK_ERROR");
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new AdminApiError("INVALID_SERVER_RESPONSE", response.status);
      }
      if (!response.ok || !payload || payload.ok !== true) {
        const code = typeof payload?.error?.code === "string" && /^[A-Z0-9_]{2,64}$/.test(payload.error.code)
          ? payload.error.code
          : response.status === 401 ? "AUTH_REQUIRED"
            : response.status === 403 ? "FORBIDDEN"
              : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "REQUEST_FAILED";
        throw new AdminApiError(code, response.status);
      }
      if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
        throw new AdminApiError("INVALID_SERVER_RESPONSE", response.status);
      }
      return payload.data;
    }
  });
}
