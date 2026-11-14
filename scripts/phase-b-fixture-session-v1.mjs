/** Phase B staging fixtures. Live mutation is hard-disabled on the review branch. */
import {execFileSync} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import {closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import {authUids, database, firestoreDocs, project} from './phase-b-http-contract-review.mjs';
import {conditionalFixtureDelete, validFirestoreReceipt} from './phase-b-offline-cleanup-guard.mjs';
import {offlinePayloads} from './phase-b-firestore-typed-fixture-preview.mjs';
import {runOwnerReadAcceptance, ownerReadAudience, readBounded, inspectAnonymousDenial} from './phase-b-owner-read-acceptance.mjs';

const markerField = 'phaseBFixtureSessionId';
const LIVE_EXECUTION_ENABLED = false;
const operator = 'yasminparmar087@gmail.com';
const healthRevision = 'oldx-owner-read-00002-tid';
const healthProbeUrl = ownerReadAudience.replace('https://', 'https://healthcheck---') + '/health';
const requestLog = 'projects/oldx-staging/logs/run.googleapis.com%2Frequests';
const authRoot = 'https://identitytoolkit.googleapis.com/v1';
const auth = authRoot + '/projects/' + project + '/';
const documentRoot = 'projects/' + project + '/databases/' + database + '/documents/';
const firestore = 'https://firestore.googleapis.com/v1/' + documentRoot;
const payloads = offlinePayloads();
const resources = Object.freeze([...authUids, ...firestoreDocs]);
const states = new Set(['CREATE_UNKNOWN', 'CREATED_VERIFIED', 'UPDATE_UNKNOWN', 'UPDATED_VERIFIED', 'DELETE_UNKNOWN', 'DELETE_ACKNOWLEDGED']);

// Deliberately reserves time for a separately supervised operator cleanup.
// This budget never refreshes credentials or authorizes any additional write.
export function runtimeSessionBudget(expiry, now = Date.now, monotonic = () => performance.now()) {
  const lifetime = expiry - now();
  requireSafe(Number.isFinite(lifetime) && lifetime > 90_000, 'RUNTIME_TOKEN_TOO_SHORT');
  const started = monotonic();
  const creationCutoff = started + Math.min(120_000, lifetime - 90_000);
  const sessionCutoff = creationCutoff + 90_000;
  let cutoff = creationCutoff;
  function remaining() {
    const ms = Math.floor(cutoff - monotonic());
    requireSafe(ms > 0, 'SESSION_DEADLINE_EXCEEDED');
    return ms;
  }
  return Object.freeze({
    beforeMutation() {
      requireSafe(monotonic() < creationCutoff, 'CREATION_PHASE_DEADLINE_EXCEEDED');
    },
    beforeRuntimeRequest() {
      requireSafe(monotonic() < creationCutoff && expiry - now() > 10_000,
        'RUNTIME_TOKEN_OR_DEADLINE_TOO_CLOSE');
    },
    beginCleanup() { cutoff = sessionCutoff; remaining(); },
    timeout(limit) { return Math.min(remaining(), limit); },
  });
}

function requireSafe(condition, code) {
  if (!condition) throw new Error(code);
}

function transport(send, key, identityProject = project) {
  async function call(method, url, body, {publicRequest = false, allowAbsent = false} = {}) {
    const {status, data} = await send({method, url, body, publicRequest});
    if (allowAbsent && status === 404 && data?.error?.status === 'NOT_FOUND') return null;
    requireSafe(status === 200, 'API_REQUEST_FAILED');
    requireSafe(data && typeof data === 'object' && !Array.isArray(data) && !data.error, 'MALFORMED_RESPONSE');
    return data;
  }
  const withKey = (url) => url + '?key=' + encodeURIComponent(key);
  return {
    async lookup(uid, email) {
      const data = await call('POST', auth + 'accounts:lookup', email ? {email: [email]} : {localId: [uid]});
      const users = Object.hasOwn(data, 'users') ? data.users : [];
      requireSafe(Array.isArray(users) && users.length <= 1, 'INVALID_AUTH_LOOKUP');
      if (!users.length) return null;
      requireSafe(users[0]?.localId === uid && (!email || users[0].email === email), 'AUTH_COLLISION_OR_MISMATCH');
      return users[0];
    },
    getDoc: (path) => call('GET', firestore + path, undefined, {allowAbsent: true}),
    createUser: (uid, email, password) => call('POST', withKey(auth + 'accounts'), {
      localId: uid, email, password, disabled: false, emailVerified: false,
    }),
    createDoc(path, sessionId) {
      const [collection, id] = path.split('/');
      return call('POST', firestore + collection + '?documentId=' + id, fixturePayload(path, sessionId));
    },
    updateProduct(path, updateTime) {
      requireSafe(path === firestoreDocs[1], 'UNEXPECTED_FIXTURE');
      return call('PATCH', firestore + path + '?updateMask.fieldPaths=revision&currentDocument.updateTime=' +
        encodeURIComponent(updateTime), {fields: {revision: {integerValue: '2'}}});
    },
    async signIn(uid, email, password) {
      // HTTPS response from the fixed Firebase endpoint. Claims are checked for project
      // and identity binding here. The trusted backend must still verify signatures.
      const {localId, idToken} = await call('POST', withKey(authRoot + '/accounts:signInWithPassword'),
        {email, password, returnSecureToken: true}, {publicRequest: true});
      requireSafe(localId === uid && typeof idToken === 'string', 'SIGN_IN_IDENTITY_MISMATCH');
      const parts = idToken.split('.');
      requireSafe(parts.length === 3 && parts[0] && parts[1] &&
        (parts[2] || identityProject === 'demo-oldx-phase-b'), 'INVALID_ID_TOKEN');
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      requireSafe(claims.aud === identityProject && claims.iss === 'https://securetoken.google.com/' + identityProject &&
        claims.sub === uid && claims.firebase?.sign_in_provider === 'password' &&
        Number.isSafeInteger(claims.exp) && claims.exp > Date.now() / 1000, 'SIGN_IN_PROJECT_MISMATCH');
      return idToken;
    },
    deleteUser: (uid) => call('POST', auth + 'accounts:delete', {localId: uid}),
    async deleteDoc(path, updateTime) {
      const result = await call('POST', firestore.slice(0, -1) + ':commit', {
        writes: [{delete: documentRoot + path, currentDocument: {updateTime}}],
      });
      requireSafe(Array.isArray(result.writeResults) && result.writeResults.length === 1, 'DELETE_NOT_ACKNOWLEDGED');
    },
  };
}

function userEvidence(user, uid, email) {
  requireSafe(user?.localId === uid && user.email === email &&
    (user.disabled === false || user.disabled === undefined) &&
    typeof user.createdAt === 'string' && /^[1-9]\d{10,15}$/.test(user.createdAt), 'AUTH_PROVENANCE_MISMATCH');
  return user.createdAt;
}

function fixturePayload(path, sessionId) {
  return {fields: {...payloads[path].fields, [markerField]: {stringValue: sessionId}}};
}

function documentEvidence(doc, path, sessionId, updated = false) {
  const fields = doc?.fields;
  const profile = fields?.profile?.mapValue?.fields;
  // Firestore may omit the repeated values field for an empty array.
  const photos = profile?.photos?.arrayValue;
  const normalized = isDeepStrictEqual(photos, {}) ? {
    ...fields, profile: {...fields.profile, mapValue: {...fields.profile.mapValue,
      fields: {...profile, photos: {...profile.photos, arrayValue: {values: []}}}}},
  } : fields;
  const receipt = {marker: fields?.[markerField]?.stringValue, createTime: doc?.createTime, updateTime: doc?.updateTime};
  const expected = fixturePayload(path, sessionId).fields;
  if (updated) expected.revision = {integerValue: '2'};
  requireSafe(doc?.name === documentRoot + path && validFirestoreReceipt(receipt, sessionId) &&
    isDeepStrictEqual(normalized, expected), 'DOCUMENT_PROVENANCE_MISMATCH');
  return receipt;
}

async function inventory(api) {
  const results = [];
  for (const uid of authUids) results.push(Boolean(await api.lookup(uid)));
  for (const path of firestoreDocs) results.push(Boolean(await api.getDoc(path)));
  return results;
}

// Kept private so CLI callers cannot supply a transport or bypass the execution gate.
async function runSession(api, openJournal, afterSignIn, runtime = null, budget = null) {
  const sessionId = randomUUID();
  const emails = authUids.map((uid) => uid + '-' + sessionId + '@example.invalid');
  requireSafe((await inventory(api)).every((present) => !present), 'FIXTURE_COLLISION');
  for (const [i, uid] of authUids.entries()) {
    requireSafe(!await api.lookup(uid, emails[i]), 'EMAIL_COLLISION');
  }
  const journal = openJournal(sessionId);
  const passwords = [];
  const tokens = [];
  const created = new Map();
  const fixtureApi = runtime ?? api;
  try {
    for (const [i, uid] of authUids.entries()) {
      budget?.beforeMutation();
      const email = emails[i];
      const password = randomBytes(32).toString('base64url') + 'aA1!';
      passwords.push(password);
      journal.record(uid, 'CREATE_UNKNOWN', {email});
      requireSafe((await api.createUser(uid, email, password)).localId === uid, 'AUTH_CREATE_MISMATCH');
      const createdAt = userEvidence(await api.lookup(uid), uid, email);
      journal.record(uid, 'CREATED_VERIFIED', {email, createdAt});
      created.set(uid, createdAt);
    }
    for (const path of firestoreDocs) {
      budget?.beforeMutation();
      journal.record(path, 'CREATE_UNKNOWN', {marker: sessionId});
      const receipt = documentEvidence(await fixtureApi.createDoc(path, sessionId), path, sessionId);
      requireSafe(isDeepStrictEqual(documentEvidence(await fixtureApi.getDoc(path), path, sessionId), receipt),
        'DOCUMENT_CREATE_NOT_VERIFIED');
      journal.record(path, 'CREATED_VERIFIED', receipt);
      created.set(path, receipt);
    }
    for (const [i, uid] of authUids.entries()) {
      budget?.beforeMutation();
      tokens.push(await api.signIn(uid, emails[i], passwords[i]));
      passwords[i] = null;
    }
    if (afterSignIn) await afterSignIn(tokens[0], tokens[1]);
    tokens.length = 0;
    if (runtime) {
      const path = firestoreDocs[1];
      const original = created.get(path);
      conditionalFixtureDelete(original, documentEvidence(await runtime.getDoc(path), path, sessionId));
      budget?.beforeMutation();
      journal.record(path, 'UPDATE_UNKNOWN', original);
      const updated = documentEvidence(await runtime.updateProduct(path, original.updateTime), path, sessionId, true);
      requireSafe(updated.createTime === original.createTime && updated.updateTime !== original.updateTime &&
        isDeepStrictEqual(documentEvidence(await runtime.getDoc(path), path, sessionId, true), updated),
      'DOCUMENT_UPDATE_NOT_VERIFIED');
      journal.record(path, 'UPDATED_VERIFIED', updated);
      created.set(path, updated);
    }
    budget?.beginCleanup();
    for (const path of [...firestoreDocs].reverse()) {
      const receipt = created.get(path);
      const {currentDocument} = conditionalFixtureDelete(receipt,
        documentEvidence(await api.getDoc(path), path, sessionId, Boolean(runtime && path === firestoreDocs[1])));
      journal.record(path, 'DELETE_UNKNOWN', receipt);
      await api.deleteDoc(path, currentDocument.updateTime);
      journal.record(path, 'DELETE_ACKNOWLEDGED');
    }
    for (const [i, uid] of authUids.entries()) {
      const createdAt = userEvidence(await api.lookup(uid), uid, emails[i]);
      requireSafe(createdAt === created.get(uid), 'AUTH_ACCOUNT_CHANGED');
      journal.record(uid, 'DELETE_UNKNOWN', {email: emails[i], createdAt});
      await api.deleteUser(uid);
      journal.record(uid, 'DELETE_ACKNOWLEDGED');
    }
    requireSafe((await inventory(api)).every((present) => !present), 'RESIDUAL_FIXTURES');
    budget?.timeout(1);
    journal.complete();
  } finally {
    passwords.length = 0;
    tokens.length = 0;
    journal.close();
  }
}

const journalRoot = () => join(homedir(), '.oldx-phase-b-fixtures-v1');
function privatePath(info) {
  return info.uid === process.getuid() && (info.mode & 0o077) === 0;
}

export function openJournal(sessionId) {
  const root = journalRoot();
  mkdirSync(root, {mode: 0o700}); // Existing session, symlink or crash residue blocks a new run.
  const directory = openSync(root, 'r');
  let file;
  try {
    requireSafe(fstatSync(directory).isDirectory() && privatePath(fstatSync(directory)), 'UNSAFE_JOURNAL_DIRECTORY');
    file = openSync(join(root, 'journal.jsonl'), 'wx', 0o600);
    const append = (entry) => {
      writeFileSync(file, JSON.stringify({...entry, at: new Date().toISOString()}) + '\n');
      fsyncSync(file);
    };
    append({version: 2, project, database, sessionId});
    fsyncSync(directory);
    const parent = openSync(homedir(), 'r');
    try { fsyncSync(parent); } finally { closeSync(parent); }
    return {
      record: (resource, state, evidence) => append({resource, state, evidence}),
      complete: () => append({state: 'ALL_ABSENT_VERIFIED'}),
      close: () => closeSync(file),
    };
  } catch (err) {
    if (file !== undefined) closeSync(file);
    throw err;
  } finally {
    closeSync(directory);
  }
}

export function journalStatus() {
  // Offline journal parser: validates local provenance and state transitions.
  // Journal entries are NOT remote Firebase ownership proof or deletion authority.
  const root = journalRoot();
  const rootInfo = lstatSync(root);
  requireSafe(rootInfo.isDirectory() && !rootInfo.isSymbolicLink() &&
    privatePath(rootInfo), 'UNSAFE_JOURNAL_DIRECTORY');
  const path = join(root, 'journal.jsonl');
  requireSafe(lstatSync(path).isFile(), 'UNSAFE_JOURNAL');
  const file = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let contents;
  try {
    const info = fstatSync(file);
    requireSafe(info.isFile() && privatePath(info) && info.nlink === 1 &&
      info.size > 0 && info.size <= 16_384, 'UNSAFE_JOURNAL');
    const buffer = Buffer.alloc(info.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(file, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
    }
    requireSafe(size === info.size && fstatSync(file).mtimeMs === info.mtimeMs, 'JOURNAL_CHANGED_DURING_READ');
    contents = buffer.toString('utf8', 0, size);
  } finally {
    closeSync(file);
  }
  return parseRecoveryJournal(contents);
}

export function parseRecoveryJournal(contents, now = Date.now()) {
  requireSafe(contents.endsWith('\n'), 'INCOMPLETE_JOURNAL');
  const lines = contents.slice(0, -1).split('\n');
  requireSafe(lines.length >= 1 && lines.length <= 40, 'INVALID_JOURNAL_LENGTH');
  const header = JSON.parse(lines.shift());
  requireSafe([1, 2].includes(header.version) && header.project === project &&
    header.database === database &&
    typeof header.sessionId === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(header.sessionId),
  'WRONG_JOURNAL');
  const started = Date.parse(header.at);
  requireSafe(Number.isFinite(started) && started <= now, 'INVALID_JOURNAL_TIME');
  let previousTime = started;
  const latest = new Map();
  const evidence = new Map();
  const updated = new Set();
  let completed = false;
  for (const line of lines) {
    const entry = JSON.parse(line);
    const {resource, state} = entry;
    requireSafe(!completed, 'ENTRY_AFTER_COMPLETION');
    if (resource === undefined && state === 'ALL_ABSENT_VERIFIED') {
      requireSafe(latest.size === resources.length && resources.every(
        (item) => latest.get(item) === 'DELETE_ACKNOWLEDGED'), 'PREMATURE_JOURNAL_COMPLETION');
      completed = true;
    }
    const at = Date.parse(entry.at);
    requireSafe(Number.isFinite(at) && at >= previousTime && at <= now, 'INVALID_JOURNAL_TIME');
    previousTime = at;
    if (completed) continue;
    requireSafe(resources.includes(resource) && states.has(state), 'INVALID_JOURNAL_ENTRY');
    const previous = latest.get(resource);
    const canUpdate = header.version === 2 && resource === firestoreDocs[1];
    const next = {
      undefined: 'CREATE_UNKNOWN',
      CREATE_UNKNOWN: 'CREATED_VERIFIED',
      CREATED_VERIFIED: canUpdate && state === 'UPDATE_UNKNOWN' ? 'UPDATE_UNKNOWN' : 'DELETE_UNKNOWN',
      UPDATE_UNKNOWN: canUpdate ? 'UPDATED_VERIFIED' : undefined,
      UPDATED_VERIFIED: 'DELETE_UNKNOWN',
      DELETE_UNKNOWN: 'DELETE_ACKNOWLEDGED',
    }[previous ?? 'undefined'];
    requireSafe(state === next, 'INVALID_JOURNAL_TRANSITION');
    const authResource = authUids.includes(resource);
    const ev = entry.evidence;
    if (state === 'CREATE_UNKNOWN') {
      requireSafe(authResource ?
        (ev?.email === resource + '-' + header.sessionId + '@example.invalid') :
        (header.version === 1 ? ev === undefined : isDeepStrictEqual(ev, {marker: header.sessionId})), 'INVALID_CREATE_EVIDENCE');
      evidence.set(resource, ev);
    } else if (state === 'CREATED_VERIFIED') {
      requireSafe(authResource ?
        (ev?.email === evidence.get(resource)?.email &&
          typeof ev?.createdAt === 'string' && /^[1-9]\d{10,15}$/.test(ev.createdAt)) :
        (header.version === 1 ? typeof ev?.updateTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(ev.updateTime) : validFirestoreReceipt(ev, header.sessionId)),
      'INVALID_CREATION_EVIDENCE');
      evidence.set(resource, ev);
    } else if (state === 'UPDATED_VERIFIED') {
      const old = evidence.get(resource);
      requireSafe(validFirestoreReceipt(ev, header.sessionId) && ev.createTime === old.createTime &&
        ev.updateTime !== old.updateTime, 'INVALID_UPDATE_EVIDENCE');
      evidence.set(resource, ev);
      updated.add(resource);
    } else if (state === 'DELETE_UNKNOWN' || state === 'UPDATE_UNKNOWN') {
      const old = evidence.get(resource);
      requireSafe(authResource ?
        ev?.email === old?.email && ev?.createdAt === old?.createdAt :
        isDeepStrictEqual(ev, old), 'DELETE_EVIDENCE_MISMATCH');
    } else {
      requireSafe(ev === undefined, 'INVALID_DELETE_ACK');
    }
    latest.set(resource, state);
  }
  // Metadata is local-only and MUST be corroborated with remote per-ID records.
  latest.evidence = evidence;
  latest.updated = updated;
  latest.sessionId = header.sessionId;
  latest.completed = completed;
  latest.stale = now - started >= 86_400_000;
  return latest;
}

export async function inspectRecovery(send, journal) {
  const api = transport(send);
  const observations = [];
  for (const resource of resources) {
    const local = journal?.get(resource) ?? 'NO_RECORDED_MUTATION';
    const evidence = journal?.evidence.get(resource);
    const isAuth = authUids.includes(resource);
    let observation = 'LOOKUP_UNVERIFIED';
    try {
      const remote = await (isAuth ? api.lookup(resource) : api.getDoc(resource));
      if (remote === null) observation = 'ABSENT_AT_CHECK_TIME';
      else if (local === 'DELETE_ACKNOWLEDGED') observation = 'PRESENT_AFTER_DELETE_ACK';
      else if (local === 'UPDATE_UNKNOWN') observation = 'PRESENT_WITH_UNVERIFIED_UPDATE';
      else if (!evidence || local === 'CREATE_UNKNOWN') observation = 'PRESENT_WITHOUT_VERIFIED_CREATION';
      else {
        observation = 'PRESENT_PROVENANCE_MISMATCH';
        try {
          const matches = isAuth
            ? userEvidence(remote, resource, evidence.email) === evidence.createdAt
            : isDeepStrictEqual(documentEvidence(remote, resource, journal.sessionId, journal.updated?.has(resource)), evidence);
          if (matches) observation = 'PRESENT_MATCHES_JOURNAL_REQUIRES_OWNER_REVIEW';
        } catch {
          // Keep the mismatch label and suppress all remote data.
        }
      }
    } catch {
      // A failed lookup must never count as absence or suppress other exact lookups.
    }
    observations.push({resource, local, observation});
  }
  return {observations, allAbsent: observations.every(({observation}) => observation === 'ABSENT_AT_CHECK_TIME')};
}

function gcloud(...args) {
  return boundedGcloud(15_000, args);
}

function boundedGcloud(timeout, args) {
  return execFileSync('gcloud', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout}).trim();
}

function guardGcloudEnvironment() {
  requireSafe(!Object.keys(process.env).some((name) =>
    /^CLOUDSDK_(API_ENDPOINT_OVERRIDES_|AUTH_|CORE_(ACCOUNT|PROJECT)$)/i.test(name)),
  'GCLOUD_OVERRIDE_BLOCKED');
}

function guardOperator(read = gcloud) {
  guardGcloudEnvironment();
  requireSafe(read('config', 'get-value', 'project') === project &&
    read('auth', 'list', '--filter=status:ACTIVE', '--format=value(account)') === operator, 'WRONG_OPERATOR_OR_PROJECT');
}

// Fixed read-only command list. Return labels and counts, never raw policy,
// principal lists or revision environment values.
export function inspectPhaseBConfiguration(read = gcloud, {preflight = false} = {}) {
  const runtime = 'oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com';
  const invoker = 'oldx-phase-b-invoker@oldx-staging.iam.gserviceaccount.com';
  const projectNumber = '38472235077';
  const region = 'asia-south1';
  const service = 'oldx-owner-read';
  const mainRevision = service + '-00001-8kr';
  const scoped = ['--project=' + project, '--account=' + operator, '--quiet', '--format=json'];
  const regional = ['--region=' + region, ...scoped];
  const result = {
    configuration: 'BLOCKED', checks: {}, effectiveDatabaseIam: 'UNVERIFIED',
    leastPrivilegeInvoker: 'UNVERIFIED', stagingExecution: 'NO_GO', production: 'HOLD_NO_GO',
    hostedAcceptance: 'UNVERIFIED', rollback: 'UNVERIFIED', hostedFixtureCleanup: 'UNVERIFIED',
  };
  function check(label, query, inspect) {
    try {
      const value = query();
      result.checks[label] = inspect(value) ? 'MATCH' : 'MISMATCH';
      return value;
    } catch {
      result.checks[label] = 'UNAVAILABLE';
    }
  }
  const json = (...args) => JSON.parse(read(...args));
  if (read === gcloud) guardGcloudEnvironment();
  check('operatorAndProject', () => [
    read('config', 'get-value', 'project'),
    read('auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'),
  ], (value) => isDeepStrictEqual(value, [project, operator]));
  if (result.checks.operatorAndProject !== 'MATCH') return result;
  check('projectNumber', () => json('projects', 'describe', project, ...scoped),
    (value) => value.projectId === project && String(value.projectNumber) === projectNumber);
  if (result.checks.projectNumber !== 'MATCH') return result;
  if (preflight) {
    result.operatorCredentialSource = 'GCLOUD_ACTIVE_ACCOUNT';
    result.effectiveTokenMintPermission = 'UNVERIFIED';
    const apiName = 'iamcredentials.googleapis.com';
    check('iamCredentialsApi', () => read('services', 'list', '--enabled',
      '--filter=config.name~^iamcredentials[.]googleapis[.]com$',
      ...scoped.slice(0, -1), '--format=value(config.name)').trim(), (name) => {
      // Membership in this enabled-only list is the state evidence.
      requireSafe(name === '' || name === apiName, 'INVALID_ENABLED_SERVICE_OUTPUT');
      return name === apiName;
    });
    for (const [label, email] of [['runtimeKeys', runtime], ['invokerKeys', invoker]]) {
      check(label, () => json('iam', 'service-accounts', 'keys', 'list', '--iam-account=' + email, ...scoped), (keys) => {
        requireSafe(Array.isArray(keys) && keys.every((key) =>
          ['USER_MANAGED', 'SYSTEM_MANAGED'].includes(key.keyType)), 'INVALID_KEY_METADATA');
        const userManaged = keys.filter((key) => key.keyType === 'USER_MANAGED').length;
        result[label] = {userManaged, systemManaged: keys.length - userManaged};
        return userManaged === 0;
      });
    }
  }

  const roles = {
    oldxProductReadFirestore: ['datastore.databases.get', 'datastore.entities.create',
      'datastore.entities.get', 'datastore.entities.update'],
    oldxProductReadAuth: ['firebaseauth.users.get'],
  };
  const rolePath = (role) => 'projects/' + project + '/roles/' + role;
  for (const [role, permissions] of Object.entries(roles)) {
    check(role, () => json('iam', 'roles', 'describe', role, ...scoped), (value) =>
      value.name === rolePath(role) && value.stage === 'ALPHA' && value.deleted !== true &&
      Array.isArray(value.includedPermissions) &&
      isDeepStrictEqual([...value.includedPermissions].sort(), permissions));
  }
  check('runtimeIdentity', () => json('iam', 'service-accounts', 'describe', runtime, ...scoped),
    (value) => value.email === runtime && value.projectId === project && value.disabled !== true);

  const bindings = (policy) => {
    requireSafe(policy && typeof policy.etag === 'string', 'INVALID_POLICY');
    const rows = policy.bindings ?? [];
    requireSafe(Array.isArray(rows) && rows.every((row) =>
      typeof row.role === 'string' && Array.isArray(row.members) &&
      row.members.every((member) => typeof member === 'string') &&
      !row.role.includes('_withcond_')), 'INVALID_BINDINGS');
    return rows;
  };
  const publicMember = (member) => ['allUsers', 'allAuthenticatedUsers'].includes(member);
  function inspectPolicy(label, policy) {
    const rows = bindings(policy);
    const invokers = rows.filter(({role}) => ['roles/run.invoker', 'roles/run.servicesInvoker'].includes(role));
    const publicBindings = rows.filter(({members}) => members.some(publicMember));
    result[label] = {directInvokerBindings: invokers.length, publicBindings: publicBindings.length};
    return rows;
  }
  check('projectPolicy', () => json('projects', 'get-iam-policy', project, ...scoped), (policy) => {
    const rows = inspectPolicy('projectPolicy', policy);
    const forRuntime = rows.filter(({members}) => members.includes('serviceAccount:' + runtime));
    const authRole = forRuntime.filter(({role}) => role === rolePath('oldxProductReadAuth'));
    const firestoreRole = forRuntime.filter(({role}) => role === rolePath('oldxProductReadFirestore'));
    return forRuntime.length === 2 && authRole.length === 1 && !authRole[0].condition &&
      firestoreRole.length === 1 && firestoreRole[0].condition?.title === 'OLDX_Staging_Default_DB_Only' &&
      firestoreRole[0].condition.expression === 'resource.name == "projects/oldx-staging/databases/(default)"' &&
      result.projectPolicy.publicBindings === 0 && result.projectPolicy.directInvokerBindings === 0 &&
      !rows.some(({members}) => members.includes('serviceAccount:' + invoker));
  });
  check('servicePolicy', () => json('run', 'services', 'get-iam-policy', service, ...regional), (policy) => {
    const rows = inspectPolicy('servicePolicy', policy);
    return result.servicePolicy.publicBindings === 0 && rows.length === 1 &&
      rows[0].role === 'roles/run.invoker' && rows[0].condition === undefined &&
      isDeepStrictEqual(rows[0].members, ['serviceAccount:' + invoker]);
  });
  check('invokerIdentity', () => json('iam', 'service-accounts', 'describe', invoker, ...scoped),
    (value) => value.email === invoker && value.projectId === project && value.disabled !== true);
  check('invokerTokenPolicy', () =>
    json('iam', 'service-accounts', 'get-iam-policy', invoker, ...scoped), (policy) => {
    const rows = bindings(policy);
    return rows.length === 1 && rows[0].role === 'roles/iam.serviceAccountOpenIdTokenCreator' &&
      rows[0].condition === undefined && isDeepStrictEqual(rows[0].members, ['user:' + operator]);
  });
  check('serviceAndTraffic', () => json('run', 'services', 'describe', service, ...regional), (value) => {
    const annotations = value.metadata?.annotations;
    const traffic = value.status?.traffic;
    if (annotations?.['run.googleapis.com/ingress'] === 'all') result.ingress = 'INTERNET_REACHABLE';
    if (preflight) {
      const tag = traffic?.find?.((row) => row.tag === 'healthcheck');
      const taggedOrigin = ownerReadAudience.replace('https://', 'https://healthcheck---');
      result.checks.serviceAudience = value.status?.url === ownerReadAudience ? 'MATCH' : 'MISMATCH';
      result.checks.latestReadyRevision = value.status?.latestReadyRevisionName === healthRevision ? 'MATCH' : 'MISMATCH';
      result.checks.taggedUrl = tag?.url === taggedOrigin ? 'MATCH' : 'MISMATCH';
      result.serviceBaseline = {
        audience: result.checks.serviceAudience === 'MATCH' ? ownerReadAudience : 'UNVERIFIED',
        latestReadyRevision: result.checks.latestReadyRevision === 'MATCH' ? healthRevision : 'UNVERIFIED',
      };
    }
    return value.metadata?.name === service && String(value.metadata?.namespace) === projectNumber &&
      result.ingress === 'INTERNET_REACHABLE' &&
      (annotations['run.googleapis.com/invoker-iam-disabled'] === undefined ||
        annotations['run.googleapis.com/invoker-iam-disabled'] === 'false') &&
      value.spec?.template?.spec?.serviceAccountName === runtime &&
      Array.isArray(traffic) && traffic.length === 2 &&
      traffic.some((row) => row.revisionName === mainRevision && row.percent === 100 && !row.tag) &&
      traffic.some((row) => row.revisionName === healthRevision && (row.percent ?? 0) === 0 && row.tag === 'healthcheck');
  });
  for (const revision of [mainRevision, healthRevision]) {
    check(revision, () => json('run', 'revisions', 'describe', revision, ...regional), (value) => {
      const containers = value.spec?.containers;
      const env = containers?.[0]?.env ?? [];
      return value.metadata?.name === revision && value.metadata?.labels?.['serving.knative.dev/service'] === service &&
        value.spec?.serviceAccountName === runtime && Array.isArray(containers) && containers.length === 1 &&
        Array.isArray(env) && env.every((entry) => entry && typeof entry.name === 'string' &&
          !['OLDX_PRODUCT_READ_ACTIVATE_STAGING', 'OLDX_PRODUCT_READ_EMULATOR'].includes(entry.name));
    });
  }
  if (Object.values(result.checks).every((status) => status === 'MATCH')) result.configuration = 'MATCH';
  else if (Object.values(result.checks).includes('MISMATCH')) result.configuration = 'FAIL';
  return result;
}

function correlateHealthDenial(read, traceId, started, finished) {
  const trace = 'projects/' + project + '/traces/' + traceId;
  const from = started - 5000;
  const until = finished + 5000;
  // Query by trace rather than filtering away conflicting entries for that trace.
  const filter = [
    'logName="' + requestLog + '"',
    'trace="' + trace + '"',
    'timestamp>="' + new Date(from).toISOString() + '"',
    'timestamp<="' + new Date(until).toISOString() + '"',
  ].join(' AND ');
  try {
    const entries = JSON.parse(read('logging', 'read', filter, '--project=' + project,
      '--account=' + operator, '--limit=2', '--format=json', '--quiet'));
    if (!Array.isArray(entries)) return 'UNAVAILABLE';
    if (entries.length === 0) return 'MISSING';
    if (entries.length !== 1) return 'AMBIGUOUS';
    const entry = entries[0];
    const labels = entry?.resource?.labels;
    const http = entry?.httpRequest;
    const at = Date.parse(entry?.timestamp);
    return entry?.logName === requestLog && entry.trace === trace &&
      entry.resource?.type === 'cloud_run_revision' &&
      labels?.project_id === project && labels.service_name === 'oldx-owner-read' &&
      labels.revision_name === healthRevision &&
      http?.requestMethod === 'GET' && http.requestUrl === healthProbeUrl && http.status === 403 &&
      Number.isFinite(at) && at >= from && at <= until &&
      typeof entry.textPayload === 'string' && /^The request was not authenticated\.(?:\s|$)/.test(entry.textPayload)
      ? 'MATCH' : 'MISMATCH';
  } catch {
    return 'UNAVAILABLE';
  }
}

export async function inspectPhaseBPreflight(read = gcloud, request = fetch) {
  const report = inspectPhaseBConfiguration(read, {preflight: true});
  report.anonymousDenial = {result: 'BLOCKED', reason: 'CONFIGURATION_NOT_MATCHED'};
  report.cleanupControls = {
    scope: resources, firestore: 'ORIGINAL_UPDATE_TIME', auth: 'UID_EMAIL_CREATION_TIME',
    authAtomicDelete: false, executionEnabled: LIVE_EXECUTION_ENABLED,
  };
  report.rollbackBaseline = report.configuration === 'MATCH' ? 'CONFIGURATION_MATCH' : 'UNVERIFIED';
  if (report.configuration !== 'MATCH') {
    report.anonymousDenial.blockingChecks = Object.entries(report.checks)
      .filter(([, status]) => status !== 'MATCH')
      .map(([check, status]) => ({check, status}));
    return report;
  }

  const signal = AbortSignal.timeout(5000);
  const traceId = randomBytes(16).toString('hex');
  const started = Date.now();
  try {
    const response = await request(healthProbeUrl, {
      method: 'GET', credentials: 'omit', redirect: 'error', signal,
      headers: {'X-Cloud-Trace-Context': traceId + '/1;o=0'},
    });
    report.anonymousDenial = {result: 'BLOCKED', httpStatus: response.status};
    const body = await readBounded(response);
    if (signal.aborted) throw new Error('PROBE_TIMEOUT');
    const denial = inspectAnonymousDenial(response, body);
    report.anonymousDenial = denial;
    if (denial.redirected || denial.httpStatus !== 403 ||
        denial.body !== 'NONEMPTY' || denial.mediaType !== 'text/html') return report;
    const echoed = response.headers.get('x-cloud-trace-context');
    if (echoed !== null && !new RegExp('^' + traceId + '(?:/[0-9]+)?(?:;o=[01])?$').test(echoed)) {
      denial.loggingEvidence = 'RESPONSE_TRACE_MISMATCH';
      return report;
    }
    denial.loggingEvidence = correlateHealthDenial(read, traceId, started, Date.now());
    if (denial.loggingEvidence === 'MATCH') denial.result = 'MATCH';
  } catch {
    report.anonymousDenial.reason = 'REQUEST_OR_BODY_UNVERIFIED';
  }
  return report;
}

function iamReadFailure(error) {
  const diagnostic = String(error?.stderr ?? error?.message ?? '');
  if (/\bSERVICE_DISABLED\b/.test(diagnostic)) return 'API_DISABLED';
  const status = /\bHTTP(?:Error)?[ :]+(400|403|404|429|5\d{2})\b/i.exec(diagnostic)?.[1];
  if (status) return Number(status) >= 500 ? 'HTTP_5XX' : 'HTTP_' + status;
  if (/\bPERMISSION_DENIED\b|\bdoes not have (?:the )?(?:required )?permission\b|\bpermission .{1,120} denied\b/i.test(diagnostic)) {
    return 'PERMISSION_DENIED';
  }
  if (/\bINVALID_ARGUMENT\b/.test(diagnostic)) return 'HTTP_400';
  if (/\bNOT_FOUND\b/.test(diagnostic)) return 'HTTP_404';
  if (/\bRESOURCE_EXHAUSTED\b/.test(diagnostic)) return 'HTTP_429';
  if (/\b(?:INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED)\b/.test(diagnostic)) return 'HTTP_5XX';
  if (/\binvalid choice\b|\bunrecognized arguments\b/i.test(diagnostic)) return 'CLI_ARGUMENT_ERROR';
  if (error instanceof SyntaxError) return 'MALFORMED_RESPONSE';
  if (error?.code === 'ENOENT' || error?.code === 'ETIMEDOUT') {
    return 'EVIDENCE_UNAVAILABLE';
  }
  return 'API_ERROR';
}

export function inspectPhaseBEffectiveIam(read = gcloud, {diagnostic = false} = {}) {
  const expectedPermissions = {
    'datastore.databases.get': 'CAN_ACCESS',
    'datastore.entities.get': 'CAN_ACCESS',
    'datastore.entities.create': 'CAN_ACCESS',
    'datastore.entities.update': 'CAN_ACCESS',
    'datastore.entities.delete': 'CANNOT_ACCESS',
  };
  const report = inspectPhaseBConfiguration(read, {preflight: true});
  report.loggingRead = 'UNVERIFIED';
  report.policyTroubleshooter = 'CONFIGURATION_NOT_MATCHED';
  const permissions = diagnostic ? ['datastore.databases.get'] : Object.keys(expectedPermissions);
  report.databasePermissions = Object.fromEntries(permissions.map((permission) => [
    permission, {expected: expectedPermissions[permission], result: 'UNVERIFIED',
      evidence: 'NOT_EVALUATED', inheritedAllowPolicies: 'UNVERIFIED'},
  ]));
  if (report.configuration !== 'MATCH') return report;

  const scope = ['--project=' + project, '--account=' + operator, '--format=json', '--quiet'];
  if (!diagnostic) try {
    const entries = JSON.parse(read('logging', 'read',
      'logName="' + requestLog + '" AND trace="projects/oldx-staging/traces/d29ad410c8cb446b9023cb960878e131"' +
        ' AND timestamp="2026-11-13T23:05:52.337034Z"',
      '--limit=2', ...scope));
    if (Array.isArray(entries) && entries.length === 1 &&
        entries[0]?.logName === requestLog &&
        entries[0].trace === 'projects/oldx-staging/traces/d29ad410c8cb446b9023cb960878e131' &&
        entries[0].timestamp === '2026-11-13T23:05:52.337034Z') {
      report.loggingRead = 'MATCH';
    }
  } catch {
    // Missing access and unavailable evidence remain unverified.
  }

  const api = 'policytroubleshooter.googleapis.com';
  try {
    const enabled = read('services', 'list', '--enabled', '--filter=config.name~^policytroubleshooter[.]googleapis[.]com$',
      ...scope.slice(0, -2), '--quiet', '--format=value(config.name)').trim();
    report.policyTroubleshooter = enabled === api ? 'API_ENABLED' : enabled === '' ? 'API_DISABLED' : 'EVIDENCE_UNAVAILABLE';
  } catch (error) {
    report.policyTroubleshooter = iamReadFailure(error);
  }
  if (report.policyTroubleshooter !== 'API_ENABLED') {
    for (const item of Object.values(report.databasePermissions)) item.evidence = report.policyTroubleshooter;
    return report;
  }
  const resourceName = 'projects/' + project + '/databases/' + database;
  const resource = '//firestore.googleapis.com/' + resourceName;
  const principal = 'oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com';
  for (const [permission, item] of Object.entries(report.databasePermissions)) {
    try {
      const evidence = JSON.parse(read('policy-intelligence', 'troubleshoot-policy', 'iam', resource,
        '--principal-email=' + principal, '--permission=' + permission,
        '--resource-name=' + resourceName, '--resource-service=firestore.googleapis.com',
        '--resource-type=firestore.googleapis.com/Database', ...scope));
      const tuple = evidence?.accessTuple;
      item.evidence = typeof evidence?.overallAccessState === 'string' && tuple
        ? 'EVIDENCE_UNAVAILABLE' : 'MALFORMED_RESPONSE';
      if (tuple?.fullResourceName === resource && tuple.principal === principal && tuple.permission === permission) {
        const policies = evidence.allowPolicyExplanation?.explainedPolicies;
        if (Array.isArray(policies)) {
          item.inheritedAllowPolicies = policies.some((policy) =>
            /^(\/\/cloudresourcemanager\.googleapis\.com\/(projects|folders|organizations)\/)/.test(policy?.fullResourceName ?? ''))
            ? 'OBSERVED' : 'UNVERIFIED';
        }
        if (['CAN_ACCESS', 'CANNOT_ACCESS'].includes(evidence.overallAccessState)) {
          item.evidence = evidence.overallAccessState;
          item.result = item.evidence === item.expected ? 'MATCH' : 'MISMATCH';
        }
      }
    } catch (error) {
      item.evidence = iamReadFailure(error);
      if (diagnostic) {
        const detail = String(error?.stderr ?? error?.message ?? '');
        const field = /\b(fullResourceName|conditionContext|resource\.name|resource\.type|resource\.service|principal|permission)\b/i.exec(detail)?.[1]?.toLowerCase();
        const code = /\bHTTP(?:Error)?[ :]+([45]\d{2})\b/i.exec(detail)?.[1];
        let reason = item.evidence;
        if (reason === 'HTTP_400') {
          reason = /\b(?:UNSUPPORTED_RESOURCE_TYPE|RESOURCE_TYPE_NOT_SUPPORTED)\b/.test(detail)
            ? 'UNSUPPORTED_RESOURCE_TYPE'
            : /\bINVALID_RESOURCE_NAME\b/.test(detail) ? 'INVALID_RESOURCE_NAME' : 'INVALID_REQUEST';
        }
        item.diagnostic = {
          httpCode: code ? Number(code) : null,
          reason,
          fieldHint: field ?? null,
        };
      }
    }
  }
  const results = Object.values(report.databasePermissions).map(({result}) => result);
  if (results.includes('MISMATCH')) report.effectiveDatabaseIam = 'MISMATCH';
  else if (!diagnostic && results.every((status) => status === 'MATCH')) report.effectiveDatabaseIam = 'MATCH';
  return report;
}

async function liveSend({method, url, body, publicRequest}, budget) {
  const read = budget ? (...args) => boundedGcloud(budget.timeout(15_000), args) : gcloud;
  guardOperator(read);
  const headers = {'Content-Type': 'application/json'};
  if (!publicRequest) {
    const token = read('auth', 'print-access-token', '--account=' + operator);
    requireSafe(Boolean(token), 'MISSING_OPERATOR_TOKEN');
    headers.Authorization = 'Bearer ' + token;
    headers['X-Goog-User-Project'] = project;
  }
  return boundedPhaseBRequest(url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(budget?.timeout(20_000) ?? 20_000),
  });
}

// No fixture or document access in this transport. The diagnostic only reads
// database metadata and opens/closes an empty read-only transaction.
async function mintRuntimeCredential(read, call, onStatus) {
  const syntax = /^[A-Za-z0-9._~+/-]{1,8192}={0,2}$/;
  const operatorToken = read('auth', 'print-access-token', '--account=' + operator, '--quiet');
  requireSafe(typeof operatorToken === 'string' && syntax.test(operatorToken), 'INVALID_OPERATOR_CREDENTIAL');
  const {status, data} = await call(
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com:generateAccessToken',
    'POST', operatorToken, {scope: ['https://www.googleapis.com/auth/datastore'], lifetime: '300s'});
  onStatus?.(Number.isInteger(status) ? status : null);
  const expiry = Date.parse(data?.expireTime);
  requireSafe(status === 200 && typeof data?.accessToken === 'string' && syntax.test(data.accessToken) &&
    data.accessToken !== operatorToken && expiry > Date.now() && expiry <= Date.now() + 305_000, 'TOKEN_UNVERIFIED');
  return {token: data.accessToken, expiry};
}

function runtimeFixtureTransport(request, {token, expiry}, budget = null) {
  return transport(({method, url, body}) => {
    budget?.beforeRuntimeRequest();
    requireSafe(expiry - Date.now() > 10_000 && firestoreDocs.some((path) => {
      const [collection, id] = path.split('/');
      return (method === 'GET' && url === firestore + path) ||
        (method === 'POST' && url === firestore + collection + '?documentId=' + id) ||
        (method === 'PATCH' && path === firestoreDocs[1] &&
          url.startsWith(firestore + path + '?updateMask.fieldPaths=revision&currentDocument.updateTime='));
    }), 'RUNTIME_FIXTURE_SCOPE_DENIED');
    return request(url, {method, redirect: 'error', signal: AbortSignal.timeout(budget?.timeout(5000) ?? 5000),
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Goog-User-Project': project},
      body: body === undefined ? undefined : JSON.stringify(body)});
  });
}

export function simulateRuntimeFixtureSession({projectId, databaseId, operatorSend, runtimeRequest, credential, journal}) {
  requireSafe(projectId === project && databaseId === database, 'RUNTIME_FIXTURE_SCOPE_DENIED');
  const budget = runtimeSessionBudget(credential.expiry);
  return runSession(transport(operatorSend, 'offline-test-key'), journal, undefined,
    runtimeFixtureTransport(runtimeRequest, credential, budget), budget)
    .catch(() => { throw new Error('SIMULATION_STOPPED'); });
}

async function directFirestoreIam(read, request) {
  const name = 'projects/' + project + '/databases/' + database;
  const base = 'https://firestore.googleapis.com/v1/' + name;
  const report = {
    configuration: 'UNVERIFIED', credential: 'UNVERIFIED', transactionRollback: 'UNVERIFIED',
    permissions: Object.fromEntries([
      'datastore.databases.get', 'datastore.databases.getMetadata', 'datastore.entities.get',
      'datastore.entities.create', 'datastore.entities.update', 'datastore.entities.delete',
    ].map((key) => [key, {result: 'UNVERIFIED'}])),
    databaseIsolation: 'UNVERIFIED', production: 'HOLD_NO_GO',
  };
  const config = inspectPhaseBConfiguration(read, {preflight: true});
  report.configuration = config.configuration === 'MATCH' ? 'PASS' :
    Object.values(config.checks).includes('MISMATCH') ? 'FAIL' : 'UNVERIFIED';
  if (report.configuration !== 'PASS') return report;

  async function call(url, method, credential, body) {
    return request(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: {Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json',
        'X-Goog-User-Project': project},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  let runtimeToken;
  try {
    ({token: runtimeToken} = await mintRuntimeCredential(read, call, (status) => {
      report.credentialHttpStatus = status;
    }));
    report.credential = 'PASS';
  } catch {
    return report;
  }

  const metadata = report.permissions['datastore.databases.getMetadata'];
  try {
    const {status, data} = await call(base, 'GET', runtimeToken);
    metadata.httpStatus = Number.isInteger(status) ? status : null;
    if (status === 200 && data?.name === name) metadata.result = 'PASS';
    if (status === 403) metadata.result = 'FAIL'; // Request rejected; cause is not inferred.
  } catch {
    // Unavailable evidence remains unverified.
  }
  const transaction = report.permissions['datastore.databases.get'];
  try {
    const {status, data} = await call(base + '/documents:beginTransaction', 'POST', runtimeToken,
      {options: {readOnly: {}}});
    transaction.httpStatus = Number.isInteger(status) ? status : null;
    if (status === 403) transaction.result = 'FAIL';
    if (status !== 200 || typeof data?.transaction !== 'string' ||
        !/^[A-Za-z0-9+/]{1,8192}={0,2}$/.test(data.transaction)) return report;
    transaction.result = 'PASS';
    const rollback = await call(base + '/documents:rollback', 'POST', runtimeToken, {transaction: data.transaction});
    report.transactionRollback = rollback.status === 200 && isDeepStrictEqual(rollback.data, {}) ? 'PASS' : 'FAIL';
  } catch {
    // No retry, no document cleanup, no raw response or transaction ID.
  }
  return report;
}

export function simulateDirectFirestoreIam(read, request) {
  return directFirestoreIam(read, request);
}

export function isDirectFirestoreIamOneShotInvocation(args, env = process.env) {
  return Array.isArray(args) && args.length === 1 && args[0] === '--direct-firestore-iam' &&
    env?.OLDX_DIRECT_FIRESTORE_IAM_APPROVAL === 'YASMIN_APPROVED_ONCE';
}

export async function runDirectFirestoreIam({ownerApprovedOnce = false} = {}) {
  requireSafe(ownerApprovedOnce === true, 'DIRECT_FIRESTORE_IAM_DISABLED');
  return directFirestoreIam(gcloud, boundedPhaseBRequest);
}

// Shared wire parsing for the fixed OAuth REST requests and isolated tests.
export async function boundedPhaseBRequest(url, options) {
  const response = await fetch(url, {...options, redirect: 'error'});
  if (!response.body || (response.status !== 200 && response.status !== 404 &&
      response.status !== 401 && response.status !== 403 && response.status !== 429 && response.status !== 503)) {
    await response.body?.cancel();
    return {status: response.status};
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    requireSafe(size <= 65_536, 'OVERSIZED_API_RESPONSE');
    chunks.push(chunk);
  }
  return {status: response.status, data: JSON.parse(Buffer.concat(chunks).toString('utf8'))};
}

export function simulateFixtureSession(fakeSend, fakeJournal, afterSignIn, {emulator = false} = {}) {
  // Fake sign-in key only. This path never imports credentials or calls liveSend.
  return runSession(transport(fakeSend, 'offline-test-key', emulator ? 'demo-oldx-phase-b' : project), fakeJournal, afterSignIn)
    .catch(() => { throw new Error('SIMULATION_STOPPED'); });
}

// Offline composition only. The CLI cannot supply the callback or a Cloud Run transport.
export async function simulateFixtureAcceptance({fixtureSend, openFakeJournal, acceptance}) {
  let result;
  await simulateFixtureSession(fixtureSend, openFakeJournal, async (ownerToken, buyerToken) => {
    result = await runOwnerReadAcceptance({...acceptance, ownerToken, buyerToken});
  });
  // Return probe results only after the fixture runner verifies all four absent.
  return result;
}

async function main(args) {
  if (args[0] === '--direct-firestore-iam') {
    requireSafe(isDirectFirestoreIamOneShotInvocation(args), 'DIRECT_FIRESTORE_IAM_DISABLED');
    requireSafe(process.platform === 'linux', 'CLOUD_SHELL_REQUIRED');
    guardOperator();
    const report = await runDirectFirestoreIam({ownerApprovedOnce: true});
    console.log(JSON.stringify(report, null, 2));
    const metadata = report.permissions['datastore.databases.getMetadata']?.result;
    const transaction = report.permissions['datastore.databases.get']?.result;
    return report.configuration === 'PASS' && report.credential === 'PASS' &&
      metadata === 'PASS' && transaction === 'PASS' && report.transactionRollback === 'PASS' ? 0 : 3;
  }
  if (args.length === 1 && args[0] === '--review') {
    console.log('Phase B v1', project, database, resources.join(', '));
    console.log('Live execution disabled. Status performs read-only exact lookups.');
    return 0;
  }
  if (args.length === 1 && args[0] === '--status') {
    requireSafe(process.platform === 'linux', 'CLOUD_SHELL_REQUIRED');
    guardOperator();
    let journal;
    try {
      journal = journalStatus();
    } catch {
      console.log('JOURNAL_UNAVAILABLE_OR_INVALID_NO_PROVENANCE');
    }
    const {observations, allAbsent} = await inspectRecovery(liveSend, journal);
    for (const {resource, observation, local} of observations) {
      console.log(resource, observation, local);
    }
    if (journal?.stale) console.log('JOURNAL_STALE_MANUAL_REVIEW_REQUIRED');
    if (allAbsent) console.log('ALL_FOUR_ABSENT_AT_CHECK_TIME');
    return allAbsent && journal?.completed && !journal.stale ? 0 : 3;
  }
  if (args.length === 1 && args[0] === '--check-configuration') {
    const report = inspectPhaseBConfiguration();
    console.log(JSON.stringify(report, null, 2));
    return report.configuration === 'MATCH' ? 0 : 3;
  }
  if (args.length === 1 && args[0] === '--check-effective-iam') {
    const report = inspectPhaseBEffectiveIam();
    console.log(JSON.stringify(report, null, 2));
    return report.effectiveDatabaseIam === 'MATCH' && report.loggingRead === 'MATCH' ? 0 : 3;
  }
  if (args.length === 1 && args[0] === '--diagnose-effective-iam') {
    const report = inspectPhaseBEffectiveIam(gcloud, {diagnostic: true});
    console.log(JSON.stringify(report, null, 2));
    return report.databasePermissions['datastore.databases.get'].result === 'MATCH' ? 0 : 3;
  }
  if (args.length === 1 && args[0] === '--cloud-preflight') {
    const report = await inspectPhaseBPreflight();
    console.log(JSON.stringify(report, null, 2));
    return report.configuration === 'MATCH' && report.anonymousDenial.result === 'MATCH' ? 0 : 3;
  }
  requireSafe(args.length === 1 && args[0] === '--execute' && LIVE_EXECUTION_ENABLED, 'LIVE_EXECUTION_DISABLED');
  requireSafe(process.platform === 'linux', 'CLOUD_SHELL_REQUIRED');
  guardOperator();
  // Future approved operator supplies the staging web key over a private inherited
  // descriptor, never argv, environment, a checked-in file or a terminal transcript.
  const key = readFileSync(3, 'utf8').trim();
  requireSafe(/^[A-Za-z0-9_-]{20,128}$/.test(key), 'INVALID_STAGING_WEB_KEY');
  requireSafe(inspectPhaseBConfiguration(gcloud, {preflight: true}).configuration === 'MATCH',
    'RUNTIME_FIXTURE_CONFIGURATION_UNVERIFIED');
  const credential = await mintRuntimeCredential(gcloud, (url, method, token, body) =>
    boundedPhaseBRequest(url, {method, redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Goog-User-Project': project},
      body: JSON.stringify(body)}));
  const budget = runtimeSessionBudget(credential.expiry);
  await runSession(transport((req) => liveSend(req, budget), key), openJournal, undefined,
    runtimeFixtureTransport(boundedPhaseBRequest, credential, budget), budget);
  console.log('All four exact resources absent at final check.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch(() => {
    console.error('STOP: request blocked or session incomplete. Do not retry mutations.');
    process.exitCode = 2;
  });
}
