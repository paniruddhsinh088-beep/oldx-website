# OLDX Provider-Neutral Image Upload Contract V1

Status: design and local policy model only. No provider account, credentials, network calls, Firebase project, bucket, billing, migration, or deployment is involved.

## Goal

Define one safe application contract that can later be implemented by R2, Cloudinary, Firebase Storage, Supabase Storage, or another approved provider without letting provider-specific URLs or client claims become authorization.

## Request flow

1. Authenticated client asks the OLDX trusted backend to start an upload, specifying only a logical surface (`product`, `store`, `profile`, `chat`) and intended parent record ID where applicable.
2. Backend derives owner UID from verified authentication; it ignores any client-supplied owner UID.
3. Backend checks parent-record access, per-user quota, rate limits, allowed surface, and lifecycle state.
4. Backend generates an opaque random object ID and a short-lived, single-object upload capability. The capability is a bearer secret; keep expiry short and never log or persist its full URL.
5. Client uploads bytes directly to a private quarantine location. Client cannot choose object key, public visibility, moderation state, or final delivery URL.
6. Trusted processor checks actual byte signature, decodes image, enforces byte/pixel/dimension limits, rejects unsupported formats and malformed files, re-encodes a safe derivative, strips EXIF/GPS metadata, and records verified dimensions/content type/hash.
7. Processor moves/copies accepted output to a controlled final namespace. Product images become publicly addressable only after product publication and moderation approval. Other surfaces remain private or use short-lived authorized reads.
8. Backend writes the provider-neutral image reference and lifecycle metadata to the application database. Firestore stores references and metadata only, never image bytes or data URLs.
9. Delete/replacement is backend-authorized, idempotent, and removes old/quarantined objects plus metadata; orphan cleanup handles interrupted workflows.

## Surface access matrix

| Surface | Upload owner | Quarantine | Final read |
|---|---|---|---|
| Product | Authenticated seller; verified product ownership | Private | Approved derivative only, and only when listing is published |
| Store | Authenticated store owner | Private | Deliberately public store image, subject to moderation |
| Profile | Authenticated account owner | Private | Private by default; any public avatar requires a separate explicit product decision |
| Chat | Authenticated chat participant; verified membership | Private | Chat participants only; temporary authorized access |

## Required metadata

- `imageId`: opaque immutable identifier
- `ownerUid`: server-derived account UID
- `surface`: fixed enum
- `parentId`: validated product/store/chat ID, when applicable
- `status`: `upload_authorized` -> `quarantined` -> `processing` -> `approved` or `rejected` -> `deleted`
- `objectKey`: server-generated, never client-selected
- `detectedContentType`, `byteSize`, `width`, `height`, `sha256`: processor-derived
- `createdAt`, `expiresAt`, `processedAt`: trusted server timestamps
- `moderationState`: trusted backend only

Never accept client-supplied `ownerUid`, `objectKey`, `publicUrl`, `moderationState`, `approved`, `published`, dimensions, MIME type, byte size, hash, or timestamps as authoritative.

## Draft policy limits

Use the per-surface draft limits in `IMAGE_UPLOAD_POLICY_PROPOSAL_V1.md` as provisional ceilings only. They require product-owner approval and backend enforcement. Browser checks are UX only and can be bypassed.

At minimum validate:
- Actual file signature and successful decoder parse, not filename or browser MIME alone.
- Allowed formats: JPEG, PNG, WebP only for V1; reject SVG, GIF, HTML, XML, PDF, archives and unknown formats.
- Byte size, width, height, total pixel count, and number of images per parent.
- Decode/re-encode in a trusted processor; remove metadata including GPS.
- Reject decompression bombs, truncated files, malformed headers, and unsupported animation.
- Use generated object names; do not trust user filenames or paths.

## Provider adapter contract

Any adapter must expose equivalent operations:
- `createUploadGrant({ ownerUid, surface, parentId, imageId, contentType, expiresAt })`
- `verifyQuarantinedObject({ imageId })`
- `readQuarantinedObject({ imageId })`
- `writeApprovedDerivative({ imageId, bytes, contentType, metadata })`
- `deleteObject({ imageId, stage })`
- `createAuthorizedRead({ imageId, viewerUid, expiresAt })`

These are interface names, not implemented provider calls. The adapter must never expose provider credentials to browser code.

## Required abuse controls

- Authentication, verified ownership/participant checks, per-account and per-IP rate limits.
- Short grant expiry and one opaque object key per grant.
- Quota limits and cost/usage alerts.
- Quarantine TTL and orphan cleanup.
- Upload attempt audit events without logging signed URLs or image contents.
- Idempotent processing/deletion and retry-safe state transitions.
- Content moderation/reporting and takedown path.
- Restrict cross-origin upload origins where provider supports it; CORS is not authorization.
- Prevent public cache publication before approval; purge cached derivatives on takedown where applicable.

## Local test boundary

Local tests should validate only deterministic policy decisions and synthetic metadata. They must not call provider APIs, read credentials, access Firebase projects, inspect real user files, or deploy rules. Emulator integration must use demo project IDs and synthetic fixtures.

## Approval gates

No runtime implementation until the owner approves provider, budget, limits, visibility policy and moderation workflow. No resource creation, billing enablement, credential connection, real-data migration, Firebase rule change or deployment without separate explicit approval.
