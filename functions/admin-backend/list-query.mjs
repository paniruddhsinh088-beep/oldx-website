const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const MAX_CURSOR_LENGTH = 512;
const MAX_QUERY_LENGTH = 100;
const ALLOWED_FILTERS = Object.freeze({
  status: new Set(["open", "in_review", "resolved", "escalated", "active", "suspended"]),
  targetType: new Set(["user", "product", "store", "report"]),
});

function scalar(value) {
  return typeof value === "string" ? value : "";
}

/**
 * Parse bounded list parameters. The cursor remains opaque: adapters must
 * validate its signature and bind it to the query/order before using it.
 */
export function parseAdminListQuery(input = {}, { allowedFilters = Object.keys(ALLOWED_FILTERS) } = {}) {
  const rawPageSize = scalar(input.pageSize);
  let pageSize = DEFAULT_PAGE_SIZE;
  if (rawPageSize !== "") {
    if (!/^[0-9]{1,3}$/.test(rawPageSize)) {
      return { ok: false, code: "INVALID_PAGE_SIZE" };
    }
    pageSize = Number(rawPageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return { ok: false, code: "INVALID_PAGE_SIZE" };
    }
  }

  const pageToken = scalar(input.pageToken);
  if (pageToken.length > MAX_CURSOR_LENGTH || (pageToken !== "" && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(pageToken))) {
    return { ok: false, code: "INVALID_PAGE_TOKEN" };
  }

  const q = scalar(input.q).trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (q.length > MAX_QUERY_LENGTH) {
    return { ok: false, code: "INVALID_QUERY" };
  }

  const filters = {};
  for (const [key, allowed] of Object.entries(ALLOWED_FILTERS)) {
    if (!allowedFilters.includes(key)) continue;
    const value = scalar(input[key]).trim();
    if (value !== "") {
      if (!allowed.has(value)) return { ok: false, code: "INVALID_FILTER" };
      filters[key] = value;
    }
  }

  // Reject unknown keys so clients cannot smuggle arbitrary paths/order fields.
  const allowedKeys = new Set(["pageSize", "pageToken", "q", ...allowedFilters]);
  if (Object.keys(input).some(key => !allowedKeys.has(key))) {
    return { ok: false, code: "UNSUPPORTED_QUERY_PARAMETER" };
  }

  return { ok: true, value: { pageSize, pageToken: pageToken || null, q, filters } };
}
