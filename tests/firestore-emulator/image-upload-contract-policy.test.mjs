import test from "node:test";
import assert from "node:assert/strict";
import { getSurfacePolicy, validateProcessedImage, validateUploadGrantRequest } from "../../scripts/image-upload-contract-policy.mjs";

test("surface policies are defined with distinct visibility boundaries", () => {
  assert.deepEqual(["product", "store", "profile", "chat"].map(getSurfacePolicy).length, 4);
  assert.equal(getSurfacePolicy("profile").visibility, "private-by-default");
  assert.equal(getSurfacePolicy("chat").visibility, "participants-only");
  assert.equal(getSurfacePolicy("product").visibility, "approved-public-derivative");
  assert.equal(getSurfacePolicy("unknown"), null);
});

test("accepts a valid processed product image", () => {
  assert.equal(validateProcessedImage({ surface: "product", contentType: "image/webp", byteSize: 200_000, width: 1200, height: 900, fileCount: 4 }).ok, true);
});

test("rejects unsupported content types including SVG", () => {
  const result = validateProcessedImage({ surface: "product", contentType: "image/svg+xml", byteSize: 1000, width: 100, height: 100 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("unsupported_content_type"));
});

test("enforces per-surface byte, dimension and pixel ceilings", () => {
  const result = validateProcessedImage({ surface: "profile", contentType: "image/jpeg", byteSize: 3 * 1024 * 1024, width: 2100, height: 2000 });
  assert.ok(result.errors.includes("invalid_byte_size"));
  assert.ok(result.errors.includes("invalid_width"));
  assert.ok(result.errors.includes("invalid_height"));
  assert.ok(result.errors.includes("pixel_limit_exceeded"));
});

test("enforces file count and rejects malformed numeric metadata", () => {
  const result = validateProcessedImage({ surface: "chat", contentType: "image/png", byteSize: -1, width: 0, height: 20, fileCount: 2 });
  assert.ok(result.errors.includes("invalid_byte_size"));
  assert.ok(result.errors.includes("invalid_width"));
  assert.ok(result.errors.includes("file_count_exceeded"));
});

test("grant requires authenticated owner, opaque id and short expiry", () => {
  assert.equal(validateUploadGrantRequest({ authenticatedUid: "synthetic-user", surface: "product", parentId: "listing_1", imageId: "Abcdefghijklmnopqrstuvwx12345678", expiresInSeconds: 120 }).ok, true);
  const result = validateUploadGrantRequest({ authenticatedUid: "", surface: "product", imageId: "not-an-id", expiresInSeconds: 3600 });
  assert.ok(result.errors.includes("authentication_required"));
  assert.ok(result.errors.includes("invalid_image_id"));
  assert.ok(result.errors.includes("invalid_grant_expiry"));
});

test("grant rejects invalid surface and parent path", () => {
  const result = validateUploadGrantRequest({ authenticatedUid: "synthetic-user", surface: "admin", parentId: "../other", imageId: "Abcdefghijklmnopqrstuvwx12345678", expiresInSeconds: 60 });
  assert.ok(result.errors.includes("unsupported_surface"));
  assert.ok(result.errors.includes("invalid_parent_id"));
});

 test("prototype names cannot bypass the media surface allowlist", () => {
  for (const surface of ["__proto__", "constructor", "toString", null, {}]) {
    assert.equal(getSurfacePolicy(surface), null);
    assert.equal(validateProcessedImage({surface,contentType:"image/jpeg",byteSize:1,width:1,height:1}).ok,false);
  }
 });
