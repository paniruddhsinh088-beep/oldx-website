import test from "node:test";
import assert from "node:assert/strict";
import { buildStoreCataloguePage } from "./store-catalogue.mjs";

const listing = (id, overrides = {}) => ({
  id, sellerUid: "seller-A", title: "Item " + id, category: "furniture",
  basePrice: 1500, finalPriceStr: "&#8377;1,500", isSold: false,
  createdAt: { seconds: 1700000000, nanoseconds: 0 },
  phone: "9999999999", whatsapp: "9999999999", userIp: "192.0.2.1",
  coords: { lat: 23.1, lng: 72.1 }, extraDetails: { secret: "hidden" },
  images: ["data:image/png;base64,secret"], isFeatured: true,
  isShopVerified: true, moderationNotes: "private", ...overrides
});
const view = (listings, opts = {}) => buildStoreCataloguePage({ storeUid: "seller-A", listings, ...opts });

test("projects only safe public card fields, never private or trust claims", () => {
  const result = view([listing("p1")]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.items[0], {
    id: "p1", title: "Item p1", category: "furniture", price: 1500,
    priceLabel: "₹1,500", available: true
  });
  for (const key of ["sellerUid", "phone", "whatsapp", "userIp", "coords", "images", "extraDetails", "isFeatured", "isShopVerified", "moderationNotes", "finalPriceStr"]) {
    assert.equal(Object.hasOwn(result.items[0], key), false);
  }
});

test("uses numeric price, never parses the HTML-entity rupee prefix as 8377", () => {
  const result = view([
    listing("expensive", { basePrice: 12000, finalPriceStr: "&#8377;12,000" }),
    listing("cheap", { basePrice: 200, finalPriceStr: "&#8377;200" })
  ], { sort: "price-low" });
  assert.deepEqual(result.items.map(p => p.id), ["cheap", "expensive"]);
  assert.equal(result.items[0].priceLabel, "₹200");
});

test("never trusts legacy display price or markup in non-projected fields", () => {
  const result = view([listing("p1", { finalPriceStr: "<img src=x onerror=alert(1)>" })]);
  assert.equal(result.ok, true);
  assert.equal(result.items[0].priceLabel, "₹1,500");
  assert.equal(JSON.stringify(result.items).includes("<img"), false);
});

test("rejects wrong seller, malformed data, unbounded and unsafe titles", () => {
  const result = view([
    listing("other", { sellerUid: "seller-B" }), listing("invalid", { title: "<script>" }),
    listing("badprice", { basePrice: "1500" }), listing("badstatus", { isSold: "false" }),
    listing("good", { title: "કિરણની ખુરશી" })
  ]);
  assert.deepEqual(result.items.map(p => p.id), ["good"]);
  assert.equal(result.skippedCount, 4);
});

test("supports Unicode NFC search without rewriting source title", () => {
  const source = listing("p1", { title: "Cafe\u0301 ખુરશી" });
  const result = view([source], { query: "Café" });
  assert.equal(result.matchedCount, 1);
  assert.equal(result.items[0].title, source.title);
  assert.equal(source.title, "Cafe\u0301 ખુરશી");
});

test("filters category and title, without searching private description or address", () => {
  const records = [listing("p1", { title: "Desk", desc: "secret" }), listing("p2", { title: "Phone", category: "mobiles" })];
  assert.deepEqual(view(records, { category: "mobiles" }).items.map(p => p.id), ["p2"]);
  assert.equal(view(records, { query: "secret" }).matchedCount, 0);
  assert.equal(view(records, { query: "phone" }).matchedCount, 1);
});

test("sorts newest, available, name and price with deterministic ID tie break", () => {
  const records = [
    listing("b", { title: "Chair 10", basePrice: 100, isSold: true, createdAt: { seconds: 20, nanoseconds: 0 } }),
    listing("a", { title: "Chair 2", basePrice: 100, createdAt: { seconds: 30, nanoseconds: 0 } }),
    listing("c", { title: "Chair 1", basePrice: 200, createdAt: { seconds: 10, nanoseconds: 0 } })
  ];
  assert.deepEqual(view(records).items.map(p => p.id), ["a", "b", "c"]);
  assert.deepEqual(view(records, { sort: "name" }).items.map(p => p.id), ["c", "a", "b"]);
  assert.deepEqual(view(records, { sort: "price-low" }).items.map(p => p.id), ["a", "b", "c"]);
  assert.deepEqual(view(records, { sort: "price-high" }).items.map(p => p.id), ["c", "a", "b"]);
  assert.deepEqual(view(records, { sort: "available" }).items.map(p => p.id), ["a", "c", "b"]);
});

test("missing or invalid timestamps sort last without executing user methods", () => {
  const result = view([listing("old", { createdAt: { toDate() { throw new Error("must not call"); } } }), listing("new", { createdAt: 2000 })]);
  assert.deepEqual(result.items.map(p => p.id), ["new", "old"]);
});

test("bounds in-memory page size and reports hasMoreInBatch, not server hasMore", () => {
  const records = Array.from({ length: 25 }, (_, i) => listing("p" + i));
  const first = view(records, { pageSize: 12 });
  assert.equal(first.items.length, 12);
  assert.equal(first.matchedCount, 25);
  assert.equal(first.hasMoreInBatch, true);
  const last = view(records, { page: 3, pageSize: 12 });
  assert.equal(last.items.length, 1);
  assert.equal(last.hasMoreInBatch, false);
  assert.equal(view(records, { page: 4, pageSize: 12 }).items.length, 0);
});

test("skips duplicate listing IDs rather than rendering repeated cards", () => {
  const result = view([listing("same"), listing("same", { title: "Other" })]);
  assert.equal(result.items.length, 1);
  assert.equal(result.skippedCount, 1);
});

test("rejects unknown categories, unsafe IDs, price overflow and negative prices", () => {
  const result = view([
    listing("bad-cat", { category: "admin" }), listing("../escape"),
    listing("negative", { basePrice: -1 }), listing("huge", { basePrice: 1e12 }),
    listing("valid", { title: "Hindi कुर्सी", basePrice: 0 })
  ]);
  assert.deepEqual(result.items.map(p => p.id), ["valid"]);
  assert.equal(result.items[0].priceLabel, "₹0");
});

test("fails closed for invalid inputs and oversized batches", () => {
  for (const options of [
    { storeUid: "../bad" }, { category: "__proto__" }, { sort: "random" },
    { query: "a".repeat(81) }, { query: "<script>" }, { page: 0 },
    { pageSize: 0 }, { pageSize: 25 }, { page: Infinity },
    { listings: Array.from({ length: 101 }, (_, i) => listing("p" + i)) },
    { listings: {} }
  ]) {
    assert.deepEqual(view([], options), { ok: false, code: "INVALID_CATALOGUE_INPUT" });
  }
});

test("rejects non-record options without throwing", () => {
  for (const input of [null, [], "bad", 7]) {
    assert.deepEqual(buildStoreCataloguePage(input), { ok: false, code: "INVALID_CATALOGUE_INPUT" });
  }
});

test("does not mutate the input records or array", () => {
  const source = Object.freeze(listing("p1", { title: "  Chair  " }));
  const records = Object.freeze([source]);
  assert.equal(view(records).items[0].title, source.title);
  assert.equal(source.title, "  Chair  ");
});

test("newest retains Firestore sub-millisecond precision and mixed timestamp ordering", () => {
  const records = [
    listing("a-older", { createdAt: { seconds: 20, nanoseconds: 100 } }),
    listing("z-newer", { createdAt: { seconds: 20, nanoseconds: 900 } }),
    listing("b-millis", { createdAt: 20000 }),
    listing("c-invalid", { createdAt: { seconds: 20, nanoseconds: 1e9 } })
  ];
  for (const sort of ["newest", "available"]) {
    const result = view(records, { sort });
    assert.deepEqual(result.items.map(p => p.id), ["z-newer", "a-older", "b-millis", "c-invalid"]);
    assert.equal(Object.hasOwn(result.items[0], "createdAt"), false);
  }
});

test("availability filter composes with category/search before bounded pagination", () => {
  const records = [
    listing("sold", { title: "Desk sold", isSold: true }),
    listing("desk-a", { title: "Desk available A" }),
    listing("phone", { title: "Desk phone", category: "mobiles" }),
    listing("desk-b", { title: "Desk available B" })
  ];
  const options = { availableOnly: true, category: "furniture", query: "desk", pageSize: 1 };
  const first = view(records, options);
  assert.equal(first.matchedCount, 2);
  assert.equal(first.hasMoreInBatch, true);
  assert.deepEqual(first.items.map(p => p.id), ["desk-a"]);
  assert.deepEqual(view(records, { ...options, page: 2 }).items.map(p => p.id), ["desk-b"]);
  assert.equal(view(records).matchedCount, 4, "default preserves all listing availability states");
  for (const availableOnly of ["false", 1, null, {}]) {
    assert.deepEqual(view(records, { availableOnly }), { ok: false, code: "INVALID_CATALOGUE_INPUT" });
  }
});

test("supported interface locales format numeric prices without translating authored titles", () => {
  const title = "કિરણનું Desk कुर्सी";
  for (const locale of ["gu", "hi", "en"]) {
    const result = view([listing("p1", { title, basePrice: 123456.4 })], { locale });
    assert.equal(result.ok, true);
    assert.equal(result.items[0].title, title);
    assert.equal(result.items[0].price, 123456);
    assert.equal(result.items[0].priceLabel, "₹" + new Intl.NumberFormat(locale + "-IN", { maximumFractionDigits: 0 }).format(123456));
    assert.deepEqual(Object.keys(result.items[0]).sort(), ["id", "title", "category", "price", "priceLabel", "available"].sort());
  }
  for (const locale of ["fr", "gu-IN", "__proto__", "", null, {}]) {
    assert.deepEqual(view([], { locale }), { ok: false, code: "INVALID_CATALOGUE_INPUT" });
  }
  assert.deepEqual(view([listing("p1")]), view([listing("p1")], { locale: "en", availableOnly: false }));
});

 test('seller Unicode and whitespace remain exact in every locale and normalized search matches without rewriting',()=>{const title='  મૂળ हिन्दी Cafe\u0301  ';for(const locale of ['gu','hi','en']){const result=view([listing('authored',{title})],{locale,query:'Café'});assert.equal(result.items[0].title,title);}});
