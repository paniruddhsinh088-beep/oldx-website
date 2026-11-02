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
export function createAdminApiClient({ getIdToken, fetchImpl = globalThis.fetch, basePath = "/api/admin",
  timeoutMs = 10000, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (typeof getIdToken !== "function" || typeof fetchImpl !== "function" ||
      typeof schedule !== "function" || typeof cancel !== "function") {
    throw new TypeError("Admin API client requires valid dependencies.");
  }
  if (basePath !== "/api/admin") throw new TypeError("Admin API base path is fixed.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new TypeError("Invalid Admin request deadline.");

  return Object.freeze({
    async request(operation, query = {}, options = {}) {
      if (typeof operation !== "string" || !Object.hasOwn(ENDPOINTS, operation)) throw new AdminApiError("UNSUPPORTED_OPERATION", 403);
      const endpoint = ENDPOINTS[operation];
      if (endpoint.method !== "GET") throw new AdminApiError("UNSUPPORTED_METHOD");
      const queryString = safeQuery(query);
      if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => key !== "signal")) throw new AdminApiError("INVALID_REQUEST_OPTIONS");
      const { signal } = options;
      if (signal !== undefined && (!signal || typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) throw new AdminApiError("INVALID_REQUEST_OPTIONS");
      if (signal?.aborted) throw new AdminApiError("REQUEST_CANCELLED");
      const controller = new AbortController();
      let timer, timedOut = false, abortListener;
      const code = () => timedOut ? "REQUEST_TIMEOUT" : "REQUEST_CANCELLED";
      const ensureActive = () => { if (controller.signal.aborted) throw new AdminApiError(code()); };
      const parentAbort = () => controller.abort();
      signal?.addEventListener("abort", parentAbort, { once: true });
      async function perform() {
        ensureActive();
        let token;
        try { token = await getIdToken(); } catch { throw new AdminApiError("AUTH_REQUIRED", 401); }
        ensureActive();
        if (typeof token !== "string" || token.length === 0) throw new AdminApiError("AUTH_REQUIRED", 401);
        const url = basePath + endpoint.path + (queryString ? "?" + queryString : "");
        let response;
        try {
          response = await fetchImpl(url, {
            method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" },
            cache: "no-store", credentials: "same-origin", redirect: "error", signal: controller.signal
          });
        } catch { throw new AdminApiError("NETWORK_ERROR"); }
        ensureActive();
        let payload;
        try { payload = await response.json(); } catch { throw new AdminApiError("INVALID_SERVER_RESPONSE", response.status); }
        ensureActive();
        if (!response.ok || !payload || payload.ok !== true) {
          const safeCode = typeof payload?.error?.code === "string" && /^[A-Z0-9_]{2,64}$/.test(payload.error.code)
            ? payload.error.code : response.status === 401 ? "AUTH_REQUIRED" : response.status === 403 ? "FORBIDDEN"
              : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "REQUEST_FAILED";
          throw new AdminApiError(safeCode, response.status);
        }
        if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) throw new AdminApiError("INVALID_SERVER_RESPONSE", response.status);
        return payload.data;
      }
      try {
        const cancelled = new Promise((resolve, reject) => {
          abortListener = () => reject(new AdminApiError(code()));
          controller.signal.addEventListener("abort", abortListener, { once: true });
        });
        timer = schedule(() => { timedOut = true; controller.abort(); }, timeoutMs);
        // Cancellation covers token refresh, fetch and response-body parsing,
        // even when an injected transport ignores abort. No automatic retry.
        return await Promise.race([perform(), cancelled]);
      } catch (error) {
        if (controller.signal.aborted) throw new AdminApiError(code());
        if (error instanceof AdminApiError) throw error;
        throw new AdminApiError("NETWORK_ERROR");
      } finally {
        if (timer !== undefined) cancel(timer);
        signal?.removeEventListener("abort", parentAbort);
        if (abortListener) controller.signal.removeEventListener("abort", abortListener);
      }
    }
  });
}
