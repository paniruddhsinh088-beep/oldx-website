# OLDX owner decision — Product title and description language (3 November 2026)

**Status: OWNER APPROVED.** Save as a durable product requirement for the OLDX website and Android app.

## Required behavior
- Preserve the seller's original text and original language for every Product **title** and **description**.
- Display Product titles and descriptions **exactly in the seller's original language** to all viewers, regardless of the viewer's selected app/site interface language.
- Example: seller writes title and description in Gujarati; a buyer who selected English sees English menus/buttons/navigation but the Product title and description remain in Gujarati.
- Do not automatically translate, rewrite, transliterate, or replace user-authored Product title/description based on interface language.
- No Translate button or translation API is required for the initial OLDX release. This decision supersedes prior translation proposals for the initial scope.
- Continue localizing application-owned UI (menus, buttons, labels, categories, error/loading states) into Gujarati, Hindi and English according to the viewer's language preference.
- Preserve exact stored Unicode text in product creation, editing, public cards, detail views, search results, sharing, and Android/Capacitor views; ensure correct Gujarati/Hindi/English font support and safe text rendering.
- Existing authorization, validation, moderation, accessibility and performance requirements still apply. Do not modify seller-authored text to achieve localization.

## Delivery priority and scope
This is a requirement/documentation decision, **not** an instruction to pause P0 integration, deploy, change live Firebase, or spend on translation services. Prioritize the November 7 website readiness path and existing source integration. Implement/verify the behavior as part of normal Product UI integration and browser acceptance.

## Operational boundaries
Only documentation was approved by this request. Work on `security-hardening-review`; no main merge, deployment, Rules/index changes, provider activation, billing, or operational approvals are implied.
