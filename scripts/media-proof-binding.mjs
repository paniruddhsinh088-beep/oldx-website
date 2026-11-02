// Second fail-closed check on claims returned by an injected trusted verifier.
// Does not authenticate provider proofs or replace the verifier.
const ownValue = (record, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};

export function mediaProofMatches(proof, expected) {
  try {
    if (!proof || Object.getPrototypeOf(proof) !== Object.prototype ||
        !expected || !['upload', 'delete'].includes(expected.purpose)) return false;
    const keys = ['purpose', 'imageId', 'nonce', 'publicId', 'expectedRevision'];
    if (keys.some(key => ownValue(proof, key) !== expected[key])) return false;
    if (!['present', 'absent'].includes(ownValue(proof, 'status'))) return false;
    return expected.purpose === 'upload'
      ? ownValue(proof, 'sourceDigest') === expected.sourceDigest
      : ownValue(proof, 'assetId') === expected.assetId;
  } catch {
    return false;
  }
}
