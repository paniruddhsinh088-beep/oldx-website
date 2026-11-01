# Service chat blocking: security design decision

**Development only — no deployment or permission change.**

The current browser adapter reads users/{viewerUid}.blockedUsers and users/{providerUid}.blockedUsers. It fails closed on unreadable data, but browser checks cannot authorize Firestore writes and reading another user's user document may violate privacy rules.

Before enabling client chat-room creation, choose a trusted backend-readable block model and audit its write authority. A suggested model is a separate private block-edge document, keyed by blocker and blocked user, where only the blocker can create/delete their edge, neither side can forge the other's block, and Firestore rules can test both directions with exists(). Do not migrate or duplicate block lists without an explicit reconciliation plan for legacy blocks.

Security cases to verify with emulator: buyer blocks provider; provider blocks buyer; both blocked; unrelated user forges edge; block removed; profile inactive; concurrent account switch; block occurs between UI permission check and room write. Firestore rules must enforce block status at write time; UI-only checks are insufficient.

Important: existing OLDX chat allow rules may overlap and grant access through OR semantics. Review full deployed rules before integration. Room creation and message sending remain disabled in service draft.
