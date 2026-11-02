import {getSurfacePolicy, validateProcessedImage} from './image-upload-contract-policy.mjs';

const opaqueId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(value);
const parentId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const revision = value => Number.isSafeInteger(value) && value >= 0;
const unavailable = () => ({ok: false, code: 'UNAVAILABLE'});

// A projector, NOT a read endpoint or publication authority. All inputs must be
// transactionally fresh trusted backend snapshots, never browser-provided facts.
// An approved derivative proof is separate from a private photo association.
export function projectTrustedPublicImages({enabled = false, mode, kind, parent, publicView, actor, associationId, association, assets, releases} = {}) {
  const policy = getSurfacePolicy(kind);
  if (enabled !== true || mode !== 'isolated-test' || !['product', 'store'].includes(kind) || !policy ||
      ![parent, publicView, actor, association].every(plainRecord) ||
      !parentId(parent.id) || !parentId(parent.ownerUid) || parent.kind !== kind ||
      parent.published !== true || !revision(parent.revision) || !revision(parent.publicationRevision) ||
      parent.publicationRevision !== parent.revision || publicView.kind !== kind ||
      publicView.id !== parent.id || publicView.revision !== parent.publicationRevision ||
      actor.uid !== parent.ownerUid || actor.canWrite !== true || actor.suspended !== false ||
      !/^[a-f0-9]{64}$/.test(associationId ?? '') || association.kind !== kind ||
      association.parentId !== parent.id || association.ownerUid !== parent.ownerUid ||
      association.service !== null || association.visibility !== 'private' ||
      association.parentRevision !== parent.revision || !revision(association.photoRevision) ||
      !Array.isArray(association.imageIds) || association.imageIds.length > policy.maxFiles ||
      !Array.isArray(assets) || !Array.isArray(releases) ||
      assets.length !== association.imageIds.length || releases.length !== association.imageIds.length) return unavailable();

  const imageIds = association.imageIds;
  if (imageIds.some(id => !opaqueId(id)) || new Set(imageIds).size !== imageIds.length) return unavailable();
  const assetById = new Map(), releaseById = new Map();
  for (const asset of assets) {
    if (!plainRecord(asset) || !opaqueId(asset.imageId) || assetById.has(asset.imageId) ||
        asset.ownerUid !== parent.ownerUid || asset.parentId !== parent.id ||
        asset.kind !== kind || asset.service !== null || asset.state !== 'attached' ||
        !revision(asset.revision) || !Array.isArray(asset.references) ||
        asset.references.length > 12 || !asset.references.includes(associationId)) return unavailable();
    assetById.set(asset.imageId, asset);
  }
  for (const release of releases) {
    if (!plainRecord(release) || !opaqueId(release.imageId) || releaseById.has(release.imageId) ||
        release.ownerUid !== parent.ownerUid || release.parentId !== parent.id ||
        release.kind !== kind || release.status !== 'approved' ||
        release.moderationApproved !== true || release.metadataStripped !== true ||
        release.contentScanned !== true || release.delivery !== 'public-derivative' ||
        release.publicationRevision !== parent.publicationRevision ||
        release.photoRevision !== association.photoRevision || !revision(release.assetRevision) ||
        !validateProcessedImage({surface:kind, contentType:release.contentType,
          byteSize:release.byteSize, width:release.width, height:release.height}).ok) return unavailable();
    releaseById.set(release.imageId, release);
  }
  const images = [];
  for (const imageId of imageIds) {
    const asset = assetById.get(imageId), release = releaseById.get(imageId);
    if (!asset || !release || asset.revision !== release.assetRevision) return unavailable();
    // Fixed-field DTO. No raw URLs, object keys, hashes, UIDs, EXIF or audit facts.
    images.push(Object.freeze({imageId, width: release.width, height: release.height,
      contentType: release.contentType}));
  }
  return Object.freeze({ok: true, images: Object.freeze(images)});
}

function plainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Reflect.ownKeys(value).every(key => typeof key === 'string' &&
      Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
  } catch { return false; }
}
