# OLDX — Owner-approved incremental UI improvements (2026-11-06)

## Decision
Preserve the existing OLDX website design and all approved functionality. **Do not redesign the website from scratch.** Apply small, polished, practical UI improvements while completing already-planned functional work, avoiding a separate large design sprint or unnecessary Codex credit consumption.

## Scope
- Home: improve search, categories and product-card clarity.
- Products: tidy photo, price and save controls.
- Stores: improve shop profile, images and catalogue presentation.
- Service Providers: improve profile, multiple services, portfolio and contact/enquiry controls.
- Chat: improve messaging readability and mobile keyboard/layout behavior without rewriting the messaging system.
- Admin: improve layout clarity and usability without expanding permissions.
- Mobile and desktop: responsive spacing, readable typography, accessible buttons, sensible desktop use of space.
- Languages: Gujarati, Hindi and English layouts remain usable, including long text.
- Future Android app: keep UI and code Capacitor-compatible for reuse.

## Implementation constraints
Reuse existing components/styles and design conventions. Prefer small CSS/layout changes alongside relevant feature development. No heavy animation, extra UI frameworks, unnecessary dependencies or speculative rewrites. Preserve performance, security, privacy, routes, feature behavior and low recurring cost. Test relevant responsive/locale flows; do not repeat unrelated large test suites. Do not treat generated design mockups as screenshots or a mandate for a full redesign.

## Priority
Functional completion, security and staging acceptance remain higher priority than cosmetic polish. No production deployment, paid service, billing, IAM or secrets changes are authorized by this UI decision. Work only on `security-hardening-review`; no `main` changes.
