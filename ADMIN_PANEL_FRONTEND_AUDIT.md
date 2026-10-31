# Admin Panel Frontend Audit

Status: static source audit only. No browser session, Firebase connection, staging data, or production data was accessed.

## Scope

Reviewed `admin.html` on `security-hardening-review` and compared its current browser-side behavior with the review-only backend starter contracts.

## Findings

### High priority — authorization is only checked in the browser UI

- The page compares the signed-in UID with a hard-coded admin UID before showing the dashboard.
- This is a navigation/UI gate, not server-side authorization. Any direct Firestore operation still depends on actual Firestore Rules.
- The repository's Emulator baseline is deny-all and does not establish that the live project's current rules safely authorize or deny these requests.
- Do not treat the hard-coded check as protection for user records or destructive operations.

**Required before release:** route Admin reads and mutations through the trusted backend; verify Firebase ID tokens server-side; resolve the immutable Admin UID/role server-side; keep the browser from directly reading private user fields or deleting products. The backend starter is review-only and is not deployed or connected.

### High priority — unbounded collection reads

- `fetchAllAdminData()` calls `.get()` on the entire `products` collection and then the entire `users` collection.
- Both result sets are retained in browser memory and rendered as complete tables.
- Search filters only the already-downloaded arrays; it does not reduce Firestore reads.
- The forensic modal derives a user's ads from the full in-memory products array.

**User impact:** increasing marketplace size increases initial load time, memory use, read cost, and the amount of private data sent to the browser.

**Required before release:** use the trusted backend's bounded cursor pagination and explicit field projection. Do not enable real collection operations until the matching collection readiness audit is complete and approved. Preserve the requirement that Admin can inspect all users by navigating pages, not by downloading every user record at once.

### High priority — private user fields sent to the browser

- The Users table renders email, last IP, and Auth UID.
- The full user document is retained in `allUsersCache`, and the selected object is passed into the forensic modal.
- The page currently requests the entire document rather than an approved field projection.

**Required before release:** define the minimum fields needed for each Admin view, enforce projection on the trusted server, and restrict IP/connection-log access to the approved investigation workflow. Do not add more private fields to the client cache.

### High priority — destructive product deletion is a direct client write

- `deleteAdminAd()` calls Firestore `.delete()` directly from the browser after a confirmation dialog.
- There is no trusted mutation endpoint or atomic append-only audit event in this page's delete path.

**Required before release:** use a narrowly allowlisted trusted mutation with strict input validation and atomic domain-change plus audit-event commit. The backend starter intentionally fails closed until an approved operation schema and real transaction adapter exist.

### Medium priority — no pagination or result-count feedback

- Ads and Users tables have no next/previous controls, page size, loading state per tab, or visible total/filtered count.
- On slow connections, the initial page waits for all products before requesting users.
- Errors are only written to the console; the page can leave the initial “Loading…” message without a useful recovery action.

**UX direction:** add accessible loading, empty, error and retry states; server-side search/filtering; stable page cursors; and a compact result count. Keep the page responsive on narrow screens.

### Medium priority — mobile table usability

- Both tables are wrapped in horizontal scrolling containers.
- On a phone, important columns and action controls may require horizontal scrolling; no compact card/list presentation is provided.
- The tab buttons do not expose selected state through `aria-selected` or `aria-pressed`.

**UX direction:** use compact mobile rows/cards with only essential information, retain a full table at wider widths, and add keyboard-accessible tab semantics and visible focus states.

### Medium priority — Stores view is absent

- The current page contains only Ads and Users tabs.
- No Stores list, store search, store detail, or store moderation workflow is present in this file.

**UX direction:** plan a Stores view using the same bounded trusted-read architecture. Do not expose or modify store contact/location fields until the public/private field policy is approved.

## Existing positive controls

- Dynamic table text is generally rendered with `textContent` / DOM nodes.
- The two `innerHTML` uses in the inspected file insert constant developer-authored icon markup, not user-supplied content.
- Product deletion has a confirmation prompt, although this is not a substitute for trusted authorization or audit logging.
- The Admin backend starter has fail-closed authorization, pagination primitives, read-operation allowlisting, mutation validation dependency, and an atomic-audit contract in source/tests. It is not a deployed backend.

## Safe implementation boundary

The following are not authorized by this audit and must remain pending explicit owner approval:
- provisioning or deploying a backend;
- connecting Firebase Admin SDK or creating service identities, IAM roles, or secrets;
- scanning live Staging or Production collections;
- changing Firestore/Storage Rules or indexes;
- enabling real Users/Products/Stores list operations;
- changing privacy/retention policy for IP addresses or investigation logs;
- enabling or changing product/store moderation and deletion behavior.

## Verification status

- Static source review: completed.
- Browser/mobile interaction test: not run.
- Firestore Emulator tests: existing suite passed in CI, but they do not prove the live Admin page is protected by the live project's Rules.
- Staging collection scan: not run; owner approval and connector/runtime access are not in place.
- Backend deployment: not performed.
- Production: untouched.
