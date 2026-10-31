import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminListQuery } from "./list-query.mjs";

test("uses a conservative default page size", () => {
  assert.deepEqual(parseAdminListQuery({}), {
    ok: true, value: { pageSize: 25, pageToken: null, q: "", filters: {} }
  });
});

test("accepts page sizes only from 1 through 50", () => {
  assert.equal(parseAdminListQuery({ pageSize: "1" }).value.pageSize, 1);
  assert.equal(parseAdminListQuery({ pageSize: "50" }).value.pageSize, 50);
  for (const value of ["0", "51", "-1", "1.5", "abc", "9999"]) {
    assert.equal(parseAdminListQuery({ pageSize: value }).ok, false);
  }
});

test("accepts only bounded signed cursor token structure", () => {\n  const token = "eyJwYWdlIjoyfQ.signature_part";\n  assert.equal(parseAdminListQuery({ pageToken: token }).value.pageToken, token);\n  for (const value of ["eyJwYWdlIjoyfQ", "bad/token.sig", "payload.", ".signature", "a.b.c"]) {\n    assert.equal(parseAdminListQuery({ pageToken: value }).code, "INVALID_PAGE_TOKEN");\n  }\n  assert.equal(parseAdminListQuery({ pageToken: "a".repeat(513) }).code, "INVALID_PAGE_TOKEN");\n});

test("trims search and strips control characters", () => {
  assert.equal(parseAdminListQuery({ q: "  ab\u0000cd  " }).value.q, "abcd");
  assert.equal(parseAdminListQuery({ q: "x".repeat(101) }).code, "INVALID_QUERY");
});

test("allows only documented filter values", () => {
  assert.deepEqual(parseAdminListQuery({ status: "in_review", targetType: "product" }).value.filters, {
    status: "in_review", targetType: "product"
  });
  assert.equal(parseAdminListQuery({ status: "anything" }).code, "INVALID_FILTER");
});

test("rejects unknown fields such as collection path or sort order", () => {
  assert.equal(parseAdminListQuery({ collection: "users" }).code, "UNSUPPORTED_QUERY_PARAMETER");
  assert.equal(parseAdminListQuery({ orderBy: "email" }).code, "UNSUPPORTED_QUERY_PARAMETER");
});

test("rejects non-string query values rather than coercing objects", () => {
  assert.equal(parseAdminListQuery({ q: { toString: () => "users" } }).value.q, "");
});
