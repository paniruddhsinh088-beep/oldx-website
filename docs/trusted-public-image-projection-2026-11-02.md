# Trusted public image projection — isolated candidate (2 November 2026)

Status: **repository-only, default disabled**. The new
projectTrustedPublicImages pure helper in
scripts/trusted-public-image-projection.mjs requires
enabled: true, mode: 'isolated-test'. It is **not** an API endpoint, an
authorized image URL generator, a processor, a database reader, a Firebase
Rules change, a deployment, or an approval to publish media.

## Purpose and trust boundary

The existing Product/Store SDK repository materializes curated text-only
public views. The separate photo-reference SDK creates **private** photo
associations against trusted parent revisions. Neither one establishes
that an image is safe to serve publicly. This candidate combines the
following **transactionally fresh trusted backend snapshots**:

- Canonical Product/Store parent, current public view and current actor
  eligibility (published, active, matching revision and owner).
- Private photo association, its 64-hex association ID, and current
  referenced asset documents (matching kind, owner, parent, revision and
  association reference).
- A **separate proposed** trusted derivative release record for each
  asset: processor-approved metadata, scan/metadata-strip evidence,
  moderation approval, explicitly public derivative delivery state,
  current asset revision, photo revision and publication revision.

A missing, stale, duplicated, malformed or inconsistent record fails
closed for the **whole** gallery. Product galleries are limited to six
images; Store to one. Profile, Provider and Chat images are never
projected through this public helper. The DTO contains only opaque
image ID, dimensions and processed content type. It never copies raw
legacy URLs, provider object keys, signed capabilities, owner IDs,
hashes, private fields, EXIF or moderation records. Legacy photos remain
in private compatibility data and require independent visibility review.

The conservative rule parent.revision === publicationRevision ===
association.parentRevision intentionally hides managed images after
a draft edit or a stale association until a new approved, revision-bound
public release exists. This may hide an otherwise safe photo; it must
not be weakened by treating a private association as public approval.

## Required before activation

The proposed release record is **not** an approved operational schema
or currently written by a trusted processor. The caller must obtain
consistent current snapshots, verify canonical public-view equality,
authorization, publication and withdrawal freshness, and use
transactional revision checks. Browser-provided snapshots are never
acceptable. Any future delivery endpoint must independently enforce
the public release and revoke/correct caches on withdrawal, moderation
takedown or account suspension. The helper does not issue URLs; private
Chat media requires a separate participant-authorized short-lived
delivery path. Do not interpret an opaque image ID as authorization.

Still missing: owner-approved provider/runtime and cost/quotas, durable
upload-attempt/quota/delete journal, actual image decoding/re-encoding,
EXIF stripping, malware/content scan and moderation, public derivative
writer, private delivery, retention/cleanup, SDK/Rules acceptance,
real device checks, staging approval and production go/no-go.
Service v1 remains text-only; no schema extension is implied.

## Verification

Targeted command:
node --test tests/integration/trusted-public-image-projection.test.mjs

The existing npm run test:provider-draft:transaction now includes the
new regression file for CI. Cases cover disabled default, unsupported
surfaces, stale publication, suspension, draft edit, reference and
release revisions, moderation/scan/metadata gates, size/type policy,
legacy URL exclusion, fixed-field privacy and accessor safety.
These are **pure Node policy tests**, not Emulator, image-provider or
live backend tests. HOLD/NO-GO remains.
