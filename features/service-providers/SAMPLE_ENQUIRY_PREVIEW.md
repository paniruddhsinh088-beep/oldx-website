# Local sample buyer-enquiry rehearsal

A synthetic provider profile now lets a buyer select one of that provider's
multiple authored services, enter 5–400 units of plain sample job notes, choose
flexible/this-week timing and review a local summary. The summary explicitly says
not sent/not a booking. No real enquiry, chat message, WhatsApp/contact, upload,
review eligibility, backend write or persistence is enabled. Real contact actions
stay disabled and the page asks users to avoid personal information.

`preview-enquiry.mjs` accepts only service/description/timing, binds the result to
the selected synthetic provider, rejects forged service/identity/role fields and
unsafe/oversized notes, and preserves NFC text and line breaks. This is local
validation, not trusted enquiry authorization. A real endpoint must verify caller,
provider publication/consent, service selection, ownership, rate limits and approved
state transitions independently before creation or any review entitlement.

The existing preview controller renders with textContent, labels errors and focuses
invalid fields or the review. Locale switches preserve authored notes/service and
translate only interface/timing text. Editing invalidates the previous summary.
Clear/cancel, profile/route change and page-hide/cache restore remove notes and
summary fields. Form autocomplete is disabled as a usability hint; it is not a
promise about every browser's history/autofill behavior. No job note enters a
share URL, clipboard message, export card or browser storage. Only the existing
allowlisted locale preference persists.

Unit and offline browser tests cover strict fields, service binding, Unicode,
unsafe notes, review/cancel/focus, disabled contact, route/page-hide clearing,
non-disclosure through sharing, locale preservation and 320px/200%-text layouts.
Actual send/inbox/accept/complete/dispute, contact disclosure and reviews remain
separate privacy/backend/Rules/owner approval gates.
