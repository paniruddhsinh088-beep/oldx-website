# Review-only Store catalogue model

`store-catalogue.mjs` is an **isolated, pure in-memory display model** for a
small, already-authorized `publicProducts` batch. It is not connected to the
legacy Store page, Firebase, Admin, a deployment or a real seller account.

- Accepts at most 100 input cards and displays at most 24 per local page.
- Requires exact seller UID matching, known category IDs, safe titles and a
  finite numeric `basePrice`; malformed records are skipped, not published.
- Explicitly projects only ID, title, category, rounded price, safe rupee label
  and availability. Never forwards phone/WhatsApp, address, coordinates, IP,
  images, private attributes, moderation data or client verification claims.
- Uses numeric `basePrice` rather than parsing legacy `finalPriceStr` HTML
  entities (`&#8377;`), which can produce incorrect price ordering.
- `availableOnly: true` filters sold listings before local pagination; default
  `false` preserves the existing mixed-availability catalogue. Accepts booleans only.
- Optional `locale` is restricted to `gu`, `hi`, `en` (default `en`) for Indian
  numeric price formatting. Authored titles and numeric sort values are preserved.
- Supports title search with Unicode NFC normalization, category filtering,
  deterministic sorting (including Firestore sub-millisecond timestamp precision),
  and bounded pagination *within the supplied batch*.
  `hasMoreInBatch` does **not** indicate whether the server has more records.

**Required before UI integration:** owner-approved public/private product split,
publication/consent policy, trusted read path, server-side cursor pagination,
indexes, seller and buyer compatibility tests, image/media policy and full
Firestore Rules Emulator tests. The current `index.html` still queries the
legacy `products` collection without a limit. This module does not fix that
runtime behavior and must never be used to justify making legacy records public.

Local standalone check: `node --test features/stores/store-catalogue.test.mjs`.
