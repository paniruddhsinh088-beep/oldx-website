/** Phase B staging fixtures. Live mutation is hard-disabled on the review branch. */
import {execFileSync} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import {closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import {authUids, database, firestoreDocs, project} from './phase-b-http-contract-review.mjs';
import {offlinePayloads} from './phase-b-firestore-typed-fixture-preview.mjs';

const LIVE_EXECUTION_ENABLED = false;
const operator = 'yasminparmar087@gmail.com';
const authRoot = 'https://identitytoolkit.googleapis.com/v1';
const auth = authRoot + '/projects/' + project + '/';
const documentRoot = 'projects/' + project + '/databases/' + database + '/documents/';
const firestore = 'https://firestore.googleapis.com/v1/' + documentRoot;
const payloads = offlinePayloads();
const resources = Object.freeze([...authUids, ...firestoreDocs]);
const states = new Set(['CREATE_UNKNOWN', 'CREATED_VERIFIED', 'DELETE_UNKNOWN', 'DELETE_ACKNOWLEDGED']);

function requireSafe(condition, code) {
  if (!condition) throw new Error(code);
}

function transport(send, key) {
  async function call(method, url, body, {publicRequest = false, allowAbsent = false, empty = false} = {}) {
    const {status, data} = await send({method, url, body, publicRequest});
    if (allowAbsent && status === 404 && data?.error?.status === 'NOT_FOUND') return null;
    requireSafe(status === 200 || (empty && status === 204), 'API_REQUEST_FAILED');
    requireSafe((empty && status === 204) ||
      (data && typeof data === 'object' && !Array.isArray(data) && !data.error), 'MALFORMED_RESPONSE');
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
    createDoc(path) {
      const [collection, id] = path.split('/');
      return call('POST', firestore + collection + '?documentId=' + id, payloads[path]);
    },
    async signIn(uid, email, password) {
      // HTTPS response from the fixed Firebase endpoint. Claims are checked for project
      // and identity binding here. The trusted backend must still verify signatures.
      const {localId, idToken} = await call('POST', withKey(authRoot + '/accounts:signInWithPassword'),
        {email, password, returnSecureToken: true}, {publicRequest: true});
      requireSafe(localId === uid && typeof idToken === 'string', 'SIGN_IN_IDENTITY_MISMATCH');
      const parts = idToken.split('.');
      requireSafe(parts.length === 3 && parts.every(Boolean), 'INVALID_ID_TOKEN');
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      requireSafe(claims.aud === project && claims.iss === 'https://securetoken.google.com/' + project &&
        claims.sub === uid && claims.firebase?.sign_in_provider === 'password' &&
        Number.isSafeInteger(claims.exp) && claims.exp > Date.now() / 1000, 'SIGN_IN_PROJECT_MISMATCH');
      return idToken;
    },
    deleteUser: (uid) => call('POST', auth + 'accounts:delete', {localId: uid}),
    deleteDoc: (path, updateTime) => call('DELETE',
      firestore + path + '?currentDocument.updateTime=' + encodeURIComponent(updateTime), undefined, {empty: true}),
  };
}

function userEvidence(user, uid, email) {
  requireSafe(user?.localId === uid && user.email === email &&
    (user.disabled === false || user.disabled === undefined) &&
    typeof user.createdAt === 'string' && /^[1-9]\d{10,15}$/.test(user.createdAt), 'AUTH_PROVENANCE_MISMATCH');
  return user.createdAt;
}

function documentEvidence(doc, path) {
  requireSafe(doc?.name === documentRoot + path &&
    typeof doc.updateTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(doc.updateTime) &&
    isDeepStrictEqual(doc.fields, payloads[path].fields), 'DOCUMENT_PROVENANCE_MISMATCH');
  return doc.updateTime;
}

async function inventory(api) {
  const results = [];
  for (const uid of authUids) results.push(Boolean(await api.lookup(uid)));
  for (const path of firestoreDocs) results.push(Boolean(await api.getDoc(path)));
  return results;
}

// Kept private so CLI callers cannot supply a transport or bypass the execution gate.
async function runSession(api, openJournal) {
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
  try {
    for (const [i, uid] of authUids.entries()) {
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
      journal.record(path, 'CREATE_UNKNOWN');
      const updateTime = documentEvidence(await api.createDoc(path), path);
      journal.record(path, 'CREATED_VERIFIED', {updateTime});
      created.set(path, updateTime);
    }
    for (const [i, uid] of authUids.entries()) {
      tokens.push(await api.signIn(uid, emails[i], passwords[i]));
      passwords[i] = null;
    }
    tokens.length = 0;
    for (const path of [...firestoreDocs].reverse()) {
      const updateTime = documentEvidence(await api.getDoc(path), path);
      requireSafe(updateTime === created.get(path), 'DOCUMENT_CHANGED');
      journal.record(path, 'DELETE_UNKNOWN', {updateTime});
      await api.deleteDoc(path, updateTime);
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
    append({version: 1, project, database, sessionId});
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
  const info = lstatSync(path);
  requireSafe(info.isFile() && !info.isSymbolicLink() &&
    privatePath(info) && info.size > 0 && info.size <= 16_384, 'UNSAFE_JOURNAL');
  const contents = readFileSync(path, 'utf8');
  requireSafe(contents.endsWith('\n'), 'INCOMPLETE_JOURNAL');
  const lines = contents.slice(0, -1).split('\n');
  requireSafe(lines.length >= 1 && lines.length <= 40, 'INVALID_JOURNAL_LENGTH');
  const header = JSON.parse(lines.shift());
  requireSafe(header.version === 1 && header.project === project &&
    header.database === database &&
    typeof header.sessionId === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(header.sessionId),
  'WRONG_JOURNAL');
  const latest = new Map();
  const evidence = new Map();
  let completed = false;
  for (const line of lines) {
    const entry = JSON.parse(line);
    const {resource, state} = entry;
    requireSafe(!completed, 'ENTRY_AFTER_COMPLETION');
    if (resource === undefined && state === 'ALL_ABSENT_VERIFIED') {
      requireSafe(latest.size === resources.length && resources.every(
        (item) => latest.get(item) === 'DELETE_ACKNOWLEDGED'), 'PREMATURE_JOURNAL_COMPLETION');
      completed = true;
      continue;
    }
    requireSafe(resources.includes(resource) && states.has(state), 'INVALID_JOURNAL_ENTRY');
    const previous = latest.get(resource);
    const next = {
      undefined: 'CREATE_UNKNOWN',
      CREATE_UNKNOWN: 'CREATED_VERIFIED',
      CREATED_VERIFIED: 'DELETE_UNKNOWN',
      DELETE_UNKNOWN: 'DELETE_ACKNOWLEDGED',
    }[previous ?? 'undefined'];
    requireSafe(state === next, 'INVALID_JOURNAL_TRANSITION');
    const authResource = authUids.includes(resource);
    const ev = entry.evidence;
    if (state === 'CREATE_UNKNOWN') {
      requireSafe(authResource ?
        (typeof ev?.email === 'string' && ev.email.startsWith(resource + '-') &&
          ev.email.endsWith('@example.invalid') && ev.email.length < 160) :
        ev === undefined, 'INVALID_CREATE_EVIDENCE');
      evidence.set(resource, ev);
    } else if (state === 'CREATED_VERIFIED') {
      requireSafe(authResource ?
        (ev?.email === evidence.get(resource)?.email &&
          typeof ev?.createdAt === 'string' && /^[1-9]\d{10,15}$/.test(ev.createdAt)) :
        (typeof ev?.updateTime === 'string' &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(ev.updateTime)),
      'INVALID_CREATION_EVIDENCE');
      evidence.set(resource, ev);
    } else if (state === 'DELETE_UNKNOWN') {
      const old = evidence.get(resource);
      requireSafe(authResource ?
        ev?.email === old?.email && ev?.createdAt === old?.createdAt :
        ev?.updateTime === old?.updateTime, 'DELETE_EVIDENCE_MISMATCH');
    } else {
      requireSafe(ev === undefined, 'INVALID_DELETE_ACK');
    }
    latest.set(resource, state);
  }
  // No automatic recovery/delete is ever authorized by local journal metadata.
  return latest;
}

function gcloud(...args) {
  return execFileSync('gcloud', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000}).trim();
}

function guardOperator() {
  requireSafe(gcloud('config', 'get-value', 'project') === project &&
    gcloud('auth', 'list', '--filter=status:ACTIVE', '--format=value(account)') === operator, 'WRONG_OPERATOR_OR_PROJECT');
}

async function liveSend({method, url, body, publicRequest}) {
  guardOperator();
  const headers = {'Content-Type': 'application/json'};
  if (!publicRequest) {
    const token = gcloud('auth', 'print-access-token', '--account=' + operator);
    requireSafe(Boolean(token), 'MISSING_OPERATOR_TOKEN');
    headers.Authorization = 'Bearer ' + token;
    headers['X-Goog-User-Project'] = project;
  }
  const response = await fetch(url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(20_000),
  });
  if (!response.body || (response.status !== 200 && response.status !== 404)) {
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

export function simulateFixtureSession(fakeSend, fakeJournal) {
  // Fake sign-in key only. This path never imports credentials or calls liveSend.
  return runSession(transport(fakeSend, 'offline-test-key'), fakeJournal)
    .catch(() => { throw new Error('SIMULATION_STOPPED'); });
}

async function main(args) {
  if (args.length === 1 && args[0] === '--review') {
    console.log('Phase B v1', project, database, resources.join(', '));
    console.log('Live execution disabled. Status performs read-only exact lookups.');
    return 0;
  }
  if (args.length === 1 && args[0] === '--status') {
    requireSafe(process.platform === 'linux', 'CLOUD_SHELL_REQUIRED');
    const journal = journalStatus();
    const present = await inventory(transport(liveSend));
    resources.forEach((resource, i) => console.log(resource, present[i] ? 'PRESENT' : 'ABSENT',
      journal.get(resource) ?? 'NO_RECORDED_MUTATION'));
    return present.some(Boolean) ? 3 : 0;
  }
  requireSafe(args.length === 1 && args[0] === '--execute' && LIVE_EXECUTION_ENABLED, 'LIVE_EXECUTION_DISABLED');
  requireSafe(process.platform === 'linux', 'CLOUD_SHELL_REQUIRED');
  guardOperator();
  // Future approved operator supplies the staging web key over a private inherited
  // descriptor, never argv, environment, a checked-in file or a terminal transcript.
  const key = readFileSync(3, 'utf8').trim();
  requireSafe(/^[A-Za-z0-9_-]{20,128}$/.test(key), 'INVALID_STAGING_WEB_KEY');
  await runSession(transport(liveSend, key), openJournal);
  console.log('All four exact resources absent at final check.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch(() => {
    console.error('STOP: request blocked or session incomplete. Do not retry mutations.');
    process.exitCode = 2;
  });
}
