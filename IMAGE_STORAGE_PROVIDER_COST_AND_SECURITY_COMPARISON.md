# IMAGE STORAGE PROVIDER COST AND SECURITY COMPARISON

Date reviewed: 2026-11-01
Repository branch: `security-hardening-review`
Status: research and recommendation only. No provider account, billing, bucket, credential, application runtime, Firebase project, or deployment was changed.

## Decision summary

For OLDX's cost-sensitive image workload, **Cloudflare R2 is the leading candidate for a controlled pilot**, with Cloudflare's free image transformation service considered separately for delivery optimization. This is not an approval to create an account, enable billing, or migrate data.

Why R2 leads:
- Standard storage currently lists 10 GB-month free, 1 million Class A requests and 10 million Class B requests per month.
- Standard storage above free allowance is listed at $0.015/GB-month.
- Internet egress is listed as free, which is attractive for a public marketplace where image reads may exceed uploads.
- It still requires a trusted upload authorization path, access controls, lifecycle/cleanup, image validation and monitoring. A public bucket or untrusted direct upload is not an acceptable shortcut.

## Official pricing snapshot

All amounts below are provider-published USD rates and quotas checked on 2026-11-01. They are not an OLDX cost estimate; actual cost depends on image count, average size, views, transformations, region/tax and service configuration. Confirm current terms before purchase.

| Provider | Free allowance / entry | Overage / paid details | OLDX assessment |
|---|---|---|---|
| Cloudflare R2 Standard | 10 GB-month; 1M Class A and 10M Class B operations/month; internet egress free | $0.015/GB-month; $4.50/M Class A; $0.36/M Class B | Best apparent storage + delivery cost profile. Needs backend-issued short-lived upload authorization and secure object policy. |
| Cloudflare Images transformations | Up to 5,000 unique transformations/month free when optimizing images stored elsewhere | Paid transformation rate shown as $0.50/1,000 unique transformations after included 5,000. Images-hosted storage/delivery are separately charged on Images Paid. | Can pair with R2 origin; avoid confusing free transformations with free hosted Images storage/delivery. |
| Cloudinary Image & Video API | Free plan: 25 credits/month, no card required | 1 credit corresponds to 1,000 transformations OR 1 GB storage OR 1 GB image bandwidth; usage across all three consumes credits together. | Easy managed media/CDN option; free allowance can be small for a marketplace with meaningful traffic. Existing unsigned store-upload preset must be audited in account before relying on it. |
| Supabase Storage | Free plan: 1 GB storage and 5 GB uncached + 5 GB cached egress in current billing docs | Pro organization starts at $25/month; storage beyond quota $0.0213/GB-month; uncached egress $0.09/GB and cached $0.03/GB beyond quota. Image transformations are Pro and above. | Reasonable managed alternative, but fixed Pro price and project pause behavior on Free may not suit production reliability. |
| Firebase Cloud Storage | Current Firebase pricing shows no-cost quotas for Blaze usage; bucket type matters. For default `*.firebasestorage.app` buckets: 5 GB-month storage, 100 GB/month downloads, 5K uploads/month and 50K downloads/month no-cost on Blaze. | Beyond included quotas follows underlying Google Cloud Storage pricing. Firebase page shows Spark not applicable for these new default bucket quotas. | User has already encountered an upgrade requirement. Do not upgrade solely for this work until total cost and billing risk are approved. |

## Security and architecture comparison

### Cloudflare R2 (leading pilot candidate)
- Keep bucket private by default.
- Browser requests a short-lived, narrowly scoped upload authorization from a trusted backend after authentication and quota checks.
- Backend controls object key, owner, allowed content type/size and upload expiry; never expose account-wide API tokens or secret keys in browser code.
- Uploads land in a quarantine prefix/bucket. A trusted processor verifies file signatures, decodes, enforces dimensions/pixel count, re-encodes, strips EXIF/GPS and produces approved derivatives.
- Public product image delivery must expose only approved derivatives for published products. Chat/profile/store images remain private or use short-lived authorized access according to policy.
- Add per-user quotas, rate limits, orphan cleanup, abuse reporting, monitoring and cost alerts.
- Consider Cloudflare Images transformations on R2-hosted originals only after confirming URL signing/cache policy and transformation costs.

### Cloudinary
- Do not assume an unsigned upload preset is safe because its name or folder is obscure.
- Inspect allowed formats, maximum file size, incoming transformations, overwrite behavior, moderation, upload limits and whether arbitrary callers can consume quota.
- Prefer server-generated signed upload parameters or a trusted upload flow; never expose API secret.
- Existing OLDX store upload preset is not verified from source code alone; dashboard settings were not accessed.

### Supabase Storage
- Use private buckets for chat/profile and any pre-moderation images.
- Public buckets are appropriate only for deliberately public approved derivatives; public bucket URLs bypass download access control.
- Set bucket-level MIME and size limits, then still validate and re-encode server-side.
- Free-plan storage/egress quotas and project pause restrictions need consideration; image transformations require Pro and above per current docs.

### Firebase Storage
- Storage access and pricing are plan/bucket dependent. The user's console showed an upgrade prompt; do not assume Spark supports their intended bucket operations.
- Keep any eventual rules owner-scoped and deny-by-default for quarantine/private paths.
- Do not deploy rules or upgrade the project as part of this research.

## OLDX-specific constraints

- Existing product image data URLs are stored in Firestore. This comparison does not migrate or read live data.
- Existing store photos use a client-usable Cloudinary unsigned preset named `Oldxbazar` and folder `oldx-stores`; actual preset restrictions are unknown.
- Profile images are duplicated between Firestore user profile and Firebase Auth profile.
- Chat attachments are currently data URLs inside message documents.
- Do not put image bytes or base64 data URLs back into Firestore.
- Never trust browser-provided MIME type, extension, dimensions, seller UID, object key, moderation state or image URL.
- Do not expose private phone numbers, exact coordinates, profile photos or chat attachments through public product documents.
- Preserve the current per-surface draft upload limits only as proposals pending product-owner approval.

## Recommendation and next gated steps

1. Keep the current no-deployment/no-billing posture.
2. Before selecting R2, define a monthly workload estimate: new uploads/month, average processed size, product images shown per page, monthly listing views, chat attachment volume and retention.
3. Build a provider-neutral upload contract and emulator/local-only tests for authorization, ownership, file validation, quarantine, processing, deletion and public derivative publication.
4. Compare a small R2 pilot against Cloudinary using synthetic files only. The pilot must not use production user content or credentials.
5. Require explicit owner approval before creating provider resources, enabling billing, connecting credentials, changing app upload behavior, migrating images, or deploying.

## Sources

- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Images pricing: https://developers.cloudflare.com/images/pricing/
- Cloudinary pricing: https://cloudinary.com/pricing
- Cloudinary billing and credits: https://cloudinary.com/documentation/billing_and_plans
- Supabase billing FAQ and quotas: https://supabase.com/docs/guides/platform/billing-faq
- Supabase Storage bucket access model: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase image transformations: https://supabase.com/docs/guides/storage/serving/image-transformations
- Firebase pricing: https://firebase.google.com/pricing

## Caveats

- Provider quotas and prices can change; USD prices exclude applicable taxes, currency conversion and payment fees.
- Free quotas are not a security boundary and do not guarantee production availability.
- This is not a legal, tax or final infrastructure cost assessment.
