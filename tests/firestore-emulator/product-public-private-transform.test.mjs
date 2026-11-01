import test from "node:test";
import assert from "node:assert/strict";
import { projectLegacyProduct } from "./product-public-private-transform.mjs";

const synthetic = {
  sellerUid: "synthetic-seller-a",
  sellerName: "Synthetic Seller",
  title: "Synthetic bicycle",
  desc: "A synthetic test listing",
  category: "vehicles",
  subCategory: "bicycles",
  basePrice: 1000,
  mrpPrice: 1200,
  discountPercent: 10,
  finalPriceStr: "₹900",
  phone: "+910000000000",
  userIp: "203.0.113.10",
  coords: { lat: 23.0225, lng: 72.5714 },
  location: "Synthetic locality, Ahmedabad",
  state: "Gujarat",
  images: [
    "https://firebasestorage.googleapis.com/v0/b/demo.invalid/o/synthetic.jpg",
    "data:image/jpeg;base64,ZmFrZQ==",
    "https://evil.example/image.jpg"
  ],
  extraDetails: { privateArbitraryValue: "must-not-copy" },
  isFeatured: true,
  isShopVerified: true,
  isSold: false,
  publicationStatus: "published",
  createdAt: "untrusted-client-time"
};

test("projects only approved public listing fields", () => {
  const result = projectLegacyProduct(synthetic);
  assert.deepEqual(result.publicProduct, {
    sellerUid: "synthetic-seller-a",
    sellerDisplayName: "Synthetic Seller",
    category: "vehicles",
    subCategory: "bicycles",
    title: "Synthetic bicycle",
    description: "A synthetic test listing",
    basePrice: 1000,
    mrpPrice: 1200,
    discountPercent: 10,
    locationLabel: "Synthetic locality, Ahmedabad",
    state: "Gujarat",
    images: ["https://firebasestorage.googleapis.com/v0/b/demo.invalid/o/synthetic.jpg"],
    isSold: false,
    publicationStatus: "pending_review",
    isFeatured: false,
    isShopVerified: false
  });
});

test("phone and exact coordinates stay in private projection with consent off", () => {
  const result = projectLegacyProduct(synthetic);
  assert.deepEqual(result.privateProduct, {
    sellerUid: "synthetic-seller-a",
    legacyContactPhone: "+910000000000",
    contactConsent: false,
    exactCoordinates: { latitude: 23.0225, longitude: 72.5714 }
  });
  assert.equal("phone" in result.publicProduct, false);
  assert.equal("coords" in result.publicProduct, false);
});

test("IP, arbitrary extraDetails, client status, timestamps and derived price strings never copy", () => {
  const result = projectLegacyProduct(synthetic);
  const combined = JSON.stringify(result);
  for (const forbidden of [
    "203.0.113.10",
    "privateArbitraryValue",
    "untrusted-client-time",
    "finalPriceStr",
    "published"
  ]) assert.equal(combined.includes(forbidden), false);
});

test("client featured and verified flags cannot grant privileges", () => {
  const result = projectLegacyProduct({
    ...synthetic,
    isFeatured: true,
    isShopVerified: true,
    publicationStatus: "published"
  });
  assert.equal(result.publicProduct.isFeatured, false);
  assert.equal(result.publicProduct.isShopVerified, false);
  assert.equal(result.publicProduct.publicationStatus, "pending_review");
});

test("invalid identifiers, prices and text are omitted rather than trusted", () => {
  const result = projectLegacyProduct({
    sellerUid: "../admin",
    title: "x".repeat(121),
    basePrice: -1,
    mrpPrice: Infinity,
    discountPercent: 101,
    desc: 42,
    location: " "
  });
  assert.equal("sellerUid" in result.publicProduct, false);
  assert.equal("title" in result.publicProduct, false);
  assert.equal("basePrice" in result.publicProduct, false);
  assert.equal("mrpPrice" in result.publicProduct, false);
  assert.equal("discountPercent" in result.publicProduct, false);
  assert.equal("description" in result.publicProduct, false);
  assert.equal("locationLabel" in result.publicProduct, false);
});

test("malformed or out-of-range coordinates are not copied", () => {
  for (const coords of [
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: "23.0", lng: 72.5 },
    "23,72",
    null
  ]) {
    const result = projectLegacyProduct({ sellerUid: "seller_a", coords });
    assert.equal("exactCoordinates" in result.privateProduct, false);
  }
});

test("data URLs, HTTP URLs, untrusted hosts and malformed images are excluded", () => {
  const result = projectLegacyProduct({
    images: [
      "data:image/png;base64,ZmFrZQ==",
      "http://res.cloudinary.com/demo/image.jpg",
      "https://evil.example/image.jpg",
      "not-a-url"
    ]
  });
  assert.deepEqual(result.publicProduct.images, []);
});

test("image count is capped, duplicates removed and output remains deterministic", () => {
  const images = Array.from(
    { length: 12 },
    (_, i) => `https://res.cloudinary.com/demo/image/upload/item-${i}.jpg`
  );
  images.push(images[0]);
  const input = { sellerUid: "seller_a", images };
  const first = projectLegacyProduct(input);
  assert.equal(first.publicProduct.images.length, 8);
  assert.deepEqual(first, projectLegacyProduct(input));
  assert.equal(images.length, 13);
});

test("missing seller identity does not invent an owner and defaults stock safely", () => {
  const result = projectLegacyProduct({ isSold: "false" });
  assert.equal("sellerUid" in result.publicProduct, false);
  assert.equal(result.publicProduct.isSold, false);
  assert.deepEqual(result.privateProduct, { contactConsent: false });
});

test("non-object legacy input is rejected", () => {
  assert.throws(() => projectLegacyProduct(null), TypeError);
  assert.throws(() => projectLegacyProduct([]), TypeError);
});

test("transform is pure and has no Firebase, network, environment or production binding", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("./product-public-private-transform.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /firebase-admin|initializeApp|oldx-1c983|oldx-staging|fetch\s*\(|process\.env/i);
});
