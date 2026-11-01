# Account Data Reference Inventory (Source-Only)

Status: static source inventory for the `security-hardening-review` branch. This is not a live database inventory. No user records were queried and no data was modified.

## Observed Firestore paths

Static references in `index.html` and `admin.html` include the following top-level paths:

| Path / collection | Source-observed purpose | Deletion/privacy concern |
|---|---|---|
| `users/{uid}` | User profile and account-related fields | Profile removal alone does not erase references elsewhere. |
| `products/{productId}` | Marketplace listings; source includes `sellerUid` references | Must find seller-owned records and UID references in moderation/verification metadata; deletion must be paginated. |
| `stores/{storeId}` | Store records and store profile data | Store owner reference and any image object must be reconciled. |
| `chats/{chatId}` | Conversation documents | Shared conversation must not be erased wholesale by one participant's request. |
| `chats/{chatId}/messages/{messageId}` | Nested messages and attachments | Must handle both sender and participant references, per-user visibility and retention rules. |
| `stats/traffic` | Traffic aggregate/document path | Determine whether any identifiers are present; preserve only genuinely aggregated, non-identifying metrics. |

The static path scan also sees the nested `messages` collection. It is not a separate top-level collection in this model.

## Source-observed identity and reference fields

The current frontend uses or writes identity-related fields including `uid`, `sellerUid`, `senderUid`, participant identifiers, seller names, and user-facing profile details. The account deletion source specifically queries products by `sellerUid` and deletes `users/{uid}`. Chat code checks `senderUid`, participant membership, and per-message `hiddenFor` arrays.

These fields are not a complete schema contract. The final inventory must inspect every writer, admin operation, nested path, and external provider integration before implementation.

## External and embedded media references

- Product, profile and chat image data may be stored inline as data URLs in Firestore fields.
- Store images use an existing Cloudinary unsigned upload preset/folder reference in source.
- A Firestore document deletion does not prove that an external Cloudinary object or a separately stored object was deleted.
- Do not assume Firebase Storage is available: the Staging console previously requested a plan upgrade and no Storage provider was configured or tested here.

## Gaps requiring owner/data review

The static scan does not prove whether separate collections for favourites, saved ads, reports, blocks, push tokens, moderation, support, audit events, or notification preferences exist. These are investigation targets only; do not create deletion queries against guessed collection names.

Before implementing deletion:
1. Inventory all Firestore collection and subcollection paths from every client and admin source file.
2. Inventory all UID-bearing fields and query patterns, including historical schema variants.
3. Confirm all media providers, account ownership, object identifiers and provider deletion APIs.
4. Distinguish shared records from user-private records.
5. Approve legal/fraud/support retention categories and timelines.
6. Build a dry-run report using synthetic/emulator fixtures first, then obtain explicit approval for any real data access or migration.

## Safety boundary

This document is a source-derived checklist only. No production or staging data was accessed. No Auth account, Firestore document, media object, provider setting, Firebase rule, secret, IAM identity, or deployment was changed.
