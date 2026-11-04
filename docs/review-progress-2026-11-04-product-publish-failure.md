# Staging Product publish failure — 4 November 2026

Baseline: `7a1a6961dc617f5368a78b44305bced0c5005172` on the authorized review
branch, matching fresh remote and initially clean. Investigation uses source and
synthetic tests only; no staging account/data, provider calls or settings changed.

## Trace and root-cause confidence

1. Auth listener sets `window.currentUser`; native wizard forms require details and
   a photo. Submit checks that user object exists; it is not trusted server ownership
   or proof of effective Firestore permission. Login can succeed while all data writes
   remain denied by Firestore Rules.
2. Optional ipify request runs first. Failure is swallowed; a stalled request has no
   explicit timeout and can delay submission. This is an existing privacy/runtime
   issue, not evidence for the observed generic catch. No external request made here.
3. Submit reads prices/category/location/contact/client feature flags, compresses the
   ORIGINAL selected images to max-800px JPEG at quality 0.7 via FileReader/canvas,
   and stores resulting Base64 strings. The separate enhanced thumbnail is a preview,
   NOT an upload confirmation. Decode/canvas failures reject before writing.
4. It constructs a legacy mixed `products` document (including seller UID/name,
   phone, IP, coordinates, Base64 and client feature flags), then awaits
   `db.collection('products').add(adData)` with a server timestamp. It does NOT use
   disabled trusted draft/publication/media adapters or Cloudinary for this path.
5. Any error previously restored the button but displayed the same generic message.
   Success modal is shown only after acknowledged add(). Form inputs were not reset.

**Most likely cause, high conditional confidence:** if the reported staging deny-all
Rules are still active and this page targets `oldx-staging`, the direct add() is denied
regardless of successful Auth, form completeness or selected photo. Source path and
local permission-denied reproduction are verified; the ACTUAL failed request/error
code, deployed Rules/config and browser console were NOT inspected. Therefore not a
confirmed remote root cause. Do not relax Rules to test this hypothesis.

Other hypotheses: browser image decode/read/canvas failure; Base64 document exceeds
Firestore's 1 MiB document limit (800px compression does not guarantee a small total
across multiple images); stale/revoked Auth; quota/network/config errors. Optional IP
lookup can stall but normally cannot trigger this catch because its error is swallowed.

Legacy unsigned `Oldxbazar` Cloudinary usage is in Store creation, not this Product
submit. It cannot directly explain this Product add() failure without an additional,
unobserved code path. No upload/preset migration was activated.

## Safe change and evidence

Existing error handler now selects allowlisted app-owned message keys for denied,
unverified session, image preparation, invalid data, quota and unconfirmed outcome.
No SDK message/payload/token/private content is rendered or newly logged. Unknown
write outcome advises checking My Ads before retrying; no automatic duplicate add().
If My Ads also fails under deny-all, stop and have the authorized staging operator
resolve the original request outcome; do not repeatedly repost. Form/photo selection
and authored Unicode are preserved. gu/hi/en catalogs and real locale event binding
are reused; generic English fallback remains if localization has not loaded. No new
endpoint, dependency, media transport or browser/platform assumption was introduced.

Local tests:
- `node --test --test-isolation=none tests/firestore-emulator/product-publish-feedback.test.mjs tests/firestore-emulator/product-image-processing-source.test.mjs`: 8/8 pass (pure VM/source mocks, NOT Emulator).
- `node --test --test-isolation=none tests/browser/marketplace-locale.test.mjs`: 5/5 pass; new denied-publish test covers gu/hi/en, 320/375px, enlarged text, private-message redaction and original Unicode with no remote requests.
- `npm run test:i18n`: 1/1 test file passed.
- `npm run test:static-build`: 3/3 passed.
New policy suite is wired into existing safety CI for the eventual approved push.

## Checkpoint / push gate

Latest instruction forbids deployment. Review-branch Git auto-deployment was explicitly
enabled by the preceding owner approval and verified on the baseline SHA. A normal
push now triggers Vercel. Therefore changes are committed LOCALLY only; no push,
manual deployment, settings change or unverified skip-marker workaround. New-source
GitHub CI cannot run until a safe push/deployment decision is clarified. No older CI
result is represented as verification for this commit. The local checkpoint SHA is
`git log -1 --format=%H -- docs/review-progress-2026-11-04-product-publish-failure.md`.

Owner decision needed: allow this commit's automatic Preview deployment, or authorize
an approved way to prevent that deployment before pushing. Do not change existing
Vercel settings without permission. Once resolved, fetch/reconcile, push only review,
verify remote SHA and exact-source CI; stop on any failure. Never promote/main.

Real staging still needs approved runtime/access, trusted mixed/public-private write
integration, quota/media/retention/Admin policies and end-to-end acceptance. This
feedback fix does not authorize publishing or make the website launch-ready.
HOLD/NO-GO remains.
