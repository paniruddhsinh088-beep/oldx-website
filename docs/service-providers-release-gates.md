# Service Providers — release gates

Status: **NOT READY FOR PRODUCTION**. This checklist applies to the isolated candidate, not the deployed OLDX rules.

## Verified in repository
- Draft input validation module and its Node test file exist.
- Isolated Firestore rules and emulator test file exist.
- GitHub Actions workflow exists to attempt both test suites.
- Production rules and live deployment have not been changed by this work.

## Required before integration
- [ ] Confirm GitHub Actions run status and inspect logs (no passing CI run verified yet).
- [ ] Execute all emulator tests against `firebase.service-providers-emulator.json`; fix failures.
- [ ] Validate category identifiers against trusted catalog, not only format.
- [ ] Decide whether owner may edit approved profiles or must re-enter review.
- [ ] Design server-side moderation and review eligibility; never trust client-supplied rating totals.
- [ ] Design consent-based public contact details; current private collection denies all client reads/writes.
- [ ] Design safe discoverability: current candidate denies collection queries, so browse/search cannot work.
- [ ] Merge service rules with existing production collections; isolated candidate denies legacy access.
- [ ] Run existing products/stores/chats regression suite and staging smoke tests.
- [ ] Obtain explicit approval before any production rule change or live deployment.

## Important limitations
The profile-draft validator is UX/data hygiene only, not authorization. The emulator candidate allows pending owner writes but is intentionally not a complete public directory. A passing isolated test suite alone would not authorize deployment.
