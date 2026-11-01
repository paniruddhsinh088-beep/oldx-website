# Deployed Firestore rules provenance blocker

Repository inspection on service-providers-development:

- No root firestore.rules file was found.
- Root firebase.json configures Firestore emulator host/port only; it does not point to a deployable rules file.
- features/service-providers/firestore.rules.draft is explicitly a standalone deny-by-default emulator draft and cannot establish production authorization behavior.

**Decision:** production chat rules are not yet available for a trustworthy OR-overlap audit. The legacy-chat-rules-audited launch flag must remain false. Do not infer production permissions from the draft, and do not deploy a new ruleset to replace unknown existing rules.

Next required input is a read-only export of the actual rules currently published in the Firebase project (and the project identity) so /chats and recursive match scopes can be reviewed without modifying production. Never request API keys or service-account credentials to perform this review.
