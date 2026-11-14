/**
 * Phase B cleanup planner — deterministic offline transition validation.
 * ZERO cloud access, no credentials, no API, no execution switch.
 *
 * Important: this state machine simulates cleanup decisions. It is NOT
 * evidence that actual Firebase Auth create/delete permission works.
 */
export const EXACT_UIDS = Object.freeze(['synthetic-seller-a','synthetic-buyer-b']);
export const EXACT_DOCS = Object.freeze([
  'marketplaceActors_v1/synthetic-seller-a',
  'marketplacePrivate_v1/product_synthetic-phase-b-read-01'
]);

export function planCleanup({inventory, observations}) {
  if (!Array.isArray(inventory) || !Array.isArray(observations)) throw Error('STOP: invalid inputs');
  if (inventory.length !== 4 || observations.length !== 4) throw Error('STOP: incomplete inventory');
  const expected = [
    ...EXACT_UIDS.map(id => ({type:'auth',id})),
    ...EXACT_DOCS.map(id => ({type:'firestore',id})),
  ];
  const actions = [];
  for (const target of expected) {
    const matches = inventory.filter(x => x.type === target.type && x.id === target.id);
    const seen = observations.filter(x => x.type === target.type && x.id === target.id);
    if (matches.length !== 1 || seen.length !== 1) throw Error('STOP: missing/duplicate target');
    const own = matches[0], current = seen[0];
    if (own.createdByThisRun !== true || own.sessionId !== current.sessionId ||
        !own.sessionId || current.exists !== true) throw Error('STOP: provenance mismatch or missing target');
    if (target.type === 'auth') {
      if (!own.creationTime || own.creationTime !== current.creationTime ||
          current.exactUid !== target.id || current.hasUnexpectedChanges === true)
        throw Error('STOP: Auth identity mismatch / changed since creation');
      actions.push({type:'auth',id:target.id, operation:'EXACT_UID_DELETE_REQUIRES_OPERATOR_APPROVAL',
        note:'No atomic generation precondition; immediately reread; stop on ambiguity'});
    } else {
      if (!validFirestoreReceipt(own, own.sessionId) || current.hasUnexpectedChanges === true)
        throw Error('STOP: Firestore provenance/updateTime unavailable');
      actions.push({type:'firestore',id:target.id,operation:'CONDITIONAL_DELETE_REQUIRES_OPERATOR_APPROVAL',
        precondition:conditionalFixtureDelete(own, current)});
    }
  }
  if (new Set(actions.map(x=>x.type+':'+x.id)).size !== 4) throw Error('STOP: unexpected target');
  return Object.freeze(actions);
}

const firestoreTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export function validFirestoreReceipt(receipt, sessionId) {
  return typeof sessionId === 'string' && receipt?.marker === sessionId &&
    [receipt.createTime, receipt.updateTime].every(time =>
      typeof time === 'string' && firestoreTimestamp.test(time) && Number.isFinite(Date.parse(time)));
}

export function conditionalFixtureDelete(original, observed) {
  if (!validFirestoreReceipt(original, original?.marker) ||
      original.marker !== observed?.marker || original.createTime !== observed.createTime ||
      original.updateTime !== observed.updateTime) throw Error('STOP: Firestore provenance/updateTime unavailable');
  return {currentDocument: {updateTime: original.updateTime}};
}
