# Synthetic buyer enquiry lifecycle

`service-buyer-preview.html` reuses the provider inbox controller, scoped detail
adapter and canonical automation model (`preview-inbox.mjs`, commit 58356e2).
No competing state machine, real account, request submission or messaging is added.
The sample buyer selector is explicitly not login. Authored fixtures contain no
real customers; one other-buyer fixture exercises participant isolation.

Buyer lists project ID/service/status/revision only. Detail revalidates participant,
provider publication, service and enquiry association. Cancellations, disputes and
completion confirmation delegate to the existing canonical transitions and require
matching revision. Terminal states cannot be replayed. Completion uses a two-step
sample-only confirmation and never produces review eligibility or real work proof.
Provider response text is canned sample content, not sent by the provider page.

Local history shows status changes in the current sample session, not a trusted
job/audit log. It contains no notes/replies. Buyer/provider scope changes, missing
or foreign links, withdrawal and page lifecycle clear detail, pending confirmation
and history. Locale changes preserve authored notes while translating only UI and
status labels. Loading is bounded in-memory view preparation; revision checks
suppress queued renders after page-hide or newer routes. No network read is implied.
Reload re-seeds fictional examples; no enquiry state or message persists.

The selector cannot secure real data: a future server must derive actor identity
from a verified token, query only participant-owned records, bind provider/service,
check current publication/block/consent policy and enforce state/revision changes
atomically with approved audit/history. Cancellation, dispute, retention after
provider withdrawal, support access and review policy remain owner-gated. Real
Rules/adapter/compatibility and device tests remain necessary. The model's plain
buyer-confirmed flag must never become a trusted review or completion grant.
