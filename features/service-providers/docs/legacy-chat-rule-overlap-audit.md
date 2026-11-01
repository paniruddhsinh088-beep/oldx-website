# Legacy chat rules audit gate: Firestore allow-rule overlap

Status: **NOT APPROVED**. This is a required review checklist, not a claim of deployment safety.

Firestore combines matching allow rules with logical OR, including recursive wildcard matches. Therefore, a restrictive service-chat fragment cannot override an existing broad /chats/{chatId} or /{document=**} allow. Deny rules in another match do not take precedence.

Before enabling service chat writes:

1. Obtain the exact deployed production Firestore rules, including rules in Firebase Console and any deployment pipeline. A staging deny-all draft is not evidence of production behavior.
2. Enumerate every match applying to /chats/{chatId}, /chats/{chatId}/messages/{messageId}, and any collection-group rules, including recursive wildcards.
3. Test each matching allow create/update/delete condition against service-shaped documents. Explicitly attempt to create a service room using legacy product-chat paths.
4. Verify server-enforced mutual blocks for both participants and reject forged participants, forged sender IDs, and spoofed serviceProviderId.
5. Confirm legacy product chat create/read/send/delete behavior remains unchanged in emulator regression tests.
6. Document rule review sign-off and a rollback strategy before any deployment.

Current status: draft service-chat rules are read-only, and all service chat writes remain disabled in the isolated emulator ruleset. The launch gate's audit flag MUST remain false until the actual deployed rules have been inspected and tested. Never set it true merely because this document exists.
