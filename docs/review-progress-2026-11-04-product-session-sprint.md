# Product session safety / November 7 checkpoint

Baseline: clean remote/local `2f3648f658b22edc995a01d8a308d0302d9d1c26`.
Owner approves review-source work and automatic Preview only; increased rollout risk
acceptance does NOT approve main, Firebase/media activation, secrets/IAM or billing.

Verified defect: legacy create read currentUser AFTER awaiting IP/image work, so an
account switch could attach the previous form to the next identity. Edit could also
finish processing/writing and mutate the next session's cache/modal state. Fixed by
capturing the starting User identity, snapshotting seller UID/name, checking identity
after await/before write and ignoring late UI effects. Same-UID re-login with a new
User object is a new scope. Buttons recover in finally; pending duplicate submit is
ignored. No writes are automatically retried. Already-issued SDK writes cannot be
cancelled; server ownership/revocation and outcome reconciliation are still mandatory.
This client guard is NOT authorization. Draft fields are not persisted or erased;
it does not claim to clear every legacy form on logout. Trusted UI hosts already
have separate scoped cleanup, unchanged. Edit failure logs no raw SDK error now.

Local focused tests: **25/25 pass** (Product publish/image/removal, mandatory photos,
shared session guards); browser locale/mobile/session regression **5/5 pass**, static
build **3/3 pass**. Exact-source CI is requested by the approved push; no new real
Firebase/Cloudinary tests. Previous source run 41862904813 was still queued at start,
not represented as green. New Review CI also executes six private-draft Emulator cases.

Launch state remains HOLD/NO-GO. Existing signed Cloudinary bridge, public/private
Products/Stores, Provider, Chat and Admin ports remain default-disabled. Actual
runtime/identity/rates, provider transport/asset inspection/delivery, moderation/
retention, indexes/schema mapping and staging rollback evidence still need the exact
operator decisions listed in product-real-staging-readiness and owner checklist.

Fastest actual slice: approved server-mediated Product draft -> private signed photo
-> independent approval -> atomic publication -> bounded public read -> edit/replace
-> withdraw, tested with two synthetic accounts/photo before any production action.
Owner action required before operations: approve exact staging runtime/schema and
credential access, media activation/quota/privacy/moderation and synthetic acceptance/
rollback scope. No secrets in chat. No production checklist item may be marked GO
from mocks/Preview success. Navy/orange/white whole-app redesign and Store/Service/
Chat/Admin/full locale/device acceptance remain unfinished; no completion percentage.
