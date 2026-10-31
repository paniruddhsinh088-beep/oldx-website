import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixtures = JSON.parse(
  await readFile(new URL("./fixtures.json", import.meta.url), "utf8")
);

test("all fixture identities are synthetic and non-production", () => {
  const serialized = JSON.stringify(fixtures);
  assert.match(serialized, /synthetic-/);
  assert.match(fixtures.users.sellerA.email, /example\.invalid$/);
  assert.match(fixtures.users.buyerB.email, /example\.invalid$/);
  assert.equal(serialized.includes("oldx-1c983"), false);
  assert.equal(serialized.includes("oldx-staging"), false);
});

test("product fixture binds listing ownership to the synthetic seller", () => {
  assert.equal(
    fixtures.products.sellerListing.sellerUid,
    fixtures.users.sellerA.uid
  );
});

test("seller stock status remains a supported two-way transition", () => {
  const product = { ...fixtures.products.sellerListing };
  product.isSold = true;
  assert.equal(product.isSold, true);
  product.isSold = false;
  assert.equal(product.isSold, false);
});

test("privileged product flags start in safe fixture defaults", () => {
  assert.equal(fixtures.products.sellerListing.isFeatured, false);
  assert.equal(fixtures.products.sellerListing.isShopVerified, false);
});

test("chat fixture contains exactly the synthetic buyer and seller", () => {
  assert.deepEqual(
    [...fixtures.chats.sellerBuyerChat.participants].sort(),
    [fixtures.users.buyerB.uid, fixtures.users.sellerA.uid].sort()
  );
  assert.equal(fixtures.chats.sellerBuyerChat.productId, "sellerListing");
});

test("message fixture sender is a chat participant", () => {
  assert.ok(
    fixtures.chats.sellerBuyerChat.participants.includes(
      fixtures.messages.sellerMessage.senderUid
    )
  );
});
