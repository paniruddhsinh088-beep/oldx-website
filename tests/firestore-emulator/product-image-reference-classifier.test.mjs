import test from "node:test";
import assert from "node:assert/strict";
import { classifyProductImageReferences } from "../../scripts/classify-product-image-references.mjs";

test("classifies legacy image data URLs without decoding their contents", () => {
  const report = classifyProductImageReferences([
    "data:image/jpeg;base64,/9j/2Q==",
    "data:image/png;base64,iVBORw0KGgo="
  ]);
  assert.equal(report.counts.legacy_data_url, 2);
  assert.deepEqual(report.entries.map(x => x.classification), ["legacy_data_url", "legacy_data_url"]);
});

test("known HTTPS providers are candidates, never approved images", () => {
  const report = classifyProductImageReferences([
    "https://firebasestorage.googleapis.com/v0/b/example/o/photo.jpg",
    "https://res.cloudinary.com/demo/image/upload/photo.webp",
    "https://lh3.googleusercontent.com/a/example"
  ]);
  assert.equal(report.counts.approved_host_candidate, 3);
  assert.equal(report.entries.every(x => x.classification === "approved_host_candidate"), true);
});

test("unknown HTTPS hosts require review", () => {
  const report = classifyProductImageReferences(["https://example.com/photo.jpg"]);
  assert.equal(report.counts.external_https_review, 1);
});

test("HTTP URLs are separately classified as insecure", () => {
  const report = classifyProductImageReferences(["http://example.com/photo.jpg"]);
  assert.equal(report.counts.insecure_http_review, 1);
});

test("malformed, unsupported and non-string values are invalid", () => {
  const report = classifyProductImageReferences([
    null, 42, {}, "ftp://example.com/photo.jpg",
    "javascript:alert(1)", "data:text/html;base64,PGgxPg==",
    "not a URL", "https://user:pass@example.com/photo.jpg"
  ]);
  assert.equal(report.counts.invalid_reference, 8);
});

test("report never echoes image contents, URLs or filenames", () => {
  const secret = "data:image/jpeg;base64,PRIVATE_IMAGE_BYTES";
  const url = "https://private.example/seller-private-photo.jpg";
  const report = classifyProductImageReferences([secret, url]);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("PRIVATE_IMAGE_BYTES"), false);
  assert.equal(serialized.includes("private.example"), false);
  assert.equal(serialized.includes("seller-private-photo.jpg"), false);
});

test("trims whitespace before classifying a URL", () => {
  const report = classifyProductImageReferences(["  https://example.com/a.jpg  "]);
  assert.equal(report.counts.external_https_review, 1);
});

test("caps processing at 10,000 entries and marks truncation", () => {
  const values = Array.from({ length: 10_005 }, () => "https://example.com/a.jpg");
  const report = classifyProductImageReferences(values);
  assert.equal(report.processedCount, 10_000);
  assert.equal(report.totalInputCount, 10_005);
  assert.equal(report.truncated, true);
  assert.equal(report.entries.length, 10_000);
});

test("rejects non-array input", () => {
  assert.throws(() => classifyProductImageReferences("https://example.com/a.jpg"), TypeError);
});
