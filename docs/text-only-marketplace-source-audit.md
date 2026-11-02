# OLDX essential journeys: source evidence versus live functionality

Read-only source audit, 2 November 2026. No live login, Firebase read/write, provider
account or deployment was tested. Consequently **no journey is newly certified as
production-functional**. Existing legacy implementations are preserved, not replaced
by demos. Staging deny-all intentionally prevents treating them as an accepted app.

| Journey | Legacy source implementation | Hardened/inactive work | Shortest remaining integration |
| --- | --- | --- | --- |
| Product browsing / seller listing | `index.html` `listenToProductsFromFirebase` uses ordered limited product listener; ad posting builds seller/text/location/image fields and adds to `products` (around lines 3855/4952). Actual source workflow, not a placeholder. | Public/private migration/category/image contracts; Store catalogue projection and bounded mock reads. | Approved public products schema/query + owner-authenticated text writes. Legacy product documents mix phone, coordinates/IP and client-selected featured/verification fields; cannot be the public trust boundary. |
| Store creation / public storefront | `saveStoreDetails` (4234) writes Store metadata to `stores/{uid}`, optional remote photo upload; Store browsing/showing and owner summary exist. | Isolated public Store catalogue/detail, publication checks, scoped query/share contracts. | Separate public Store view from owner/contact/location data, trusted publication/ownership and text-only save contract. Do not activate uploads or expose full legacy Store documents. |
| Service registration / discovery | Homepage links isolated Service UI; provider draft, public profiles and enquiry views are preview-only. No real registration/save is connected. | Default-disabled discovery/detail repositories, public projection, canonical publication/generation checks; injected authenticated private draft preparation. | Actual verified owner mapping, private draft transaction, publication writer/public view/index adapter. New draft intent is not saved/published. |
| Login / authenticated interactions | `signInWithPopup`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword` and auth listener exist (3361/3419/3458/2122). | Candidate auth/ownership policies and injected verified-identity interfaces. | Verify actual selected auth configuration and server token checks in approved environment. No live authentication evidence from this task; client UID alone cannot authorize writes. |
| Text Chat / enquiries | `sendChatMessageNow` appends text messages; listener orders/limits 35 messages (2828/2615). Block/read/delete UI source exists. Service enquiries remain synthetic. | Message/block/privacy models, candidate Rules, bounded conversation reads, disabled messaging intent. | Trusted participant/block/freshness/rate/idempotency enforcement and privacy-safe data split; approved namespace/retention. No real messages sent. |
| Minimum Admin | `admin.html` has UID-gated UI, unbounded product/user reads and direct mutations (204/243 onward). Source exists but is unsafe to connect as trusted management. | Dependency-injected server authz/read/HTTP/client helpers and fail-closed mutation validation. | Named server roles, bounded DTO reads, minimal approved mutation schema and atomic audit. Do not reuse UI UID checks as authorization. |

The added `scripts/provider-draft-preparation.mjs` is an inactive registration
integration component: injected verified authentication -> owner-only canonical
lookup -> strict normalized private draft intent. No client owner/ID/status/privilege
selection, persistence, contact or publication. Server allocation/ownership mapping,
transactional revision check, idempotency, audit, taxonomy policy, rate limits and
actual Rules/adapter tests remain necessary before saving. Existing public readers
never consume this private intent as a publication grant.

See [owner decisions](text-only-launch-owner-decisions.md) for recommended low-cost
defaults. Cost/quota eligibility is unverified; no paid service is assumed. A working
marketplace requires all essential journeys, not just the first public read slice.
