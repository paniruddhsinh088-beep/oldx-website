/** Offline Linux journal persistence/recovery evidence — zero Cloud transport. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {openJournal, journalStatus} from '../../scripts/phase-b-fixture-session-v1.mjs';
import {authUids, firestoreDocs} from '../../scripts/phase-b-http-contract-review.mjs';

const createdAt = '1794614400000';
const updateTime = '2026-11-14T00:00:00.000001Z';

function fixtureJournal(home) {
  const journal = openJournal(randomUUID());
  for (const uid of authUids) {
    const email = uid + '-synthetic-test@example.invalid';
    journal.record(uid, 'CREATE_UNKNOWN', {email});
    journal.record(uid, 'CREATED_VERIFIED', {email, createdAt});
  }
  for (const doc of firestoreDocs) {
    journal.record(doc, 'CREATE_UNKNOWN');
    journal.record(doc, 'CREATED_VERIFIED', {updateTime});
  }
  return journal;
}

function isolatedHome(fn) {
  const old = process.env.HOME;
  const home = mkdtempSync(join(tmpdir(), 'oldx-journal-review-'));
  process.env.HOME = home;
  try { return fn(home); }
  finally {
    if (old === undefined) delete process.env.HOME;
    else process.env.HOME = old;
    rmSync(home, {recursive: true, force: true});
  }
}

test('Linux journal persisted, private, restart-readable, and duplicate-create blocked', {skip: process.platform !== 'linux'}, () =>
  isolatedHome((home) => {
    const journal = fixtureJournal(home);
    const root = join(home, '.oldx-phase-b-fixtures-v1');
    const path = join(root, 'journal.jsonl');
    journal.close(); // simulate process ending before cleanup
    assert.equal(statSync(root).mode & 0o077, 0);
    assert.equal(statSync(path).mode & 0o077, 0);
    const report = journalStatus();
    assert.equal(report.size, 4);
    for (const resource of [...authUids, ...firestoreDocs]) {
      assert.equal(report.get(resource), 'CREATED_VERIFIED');
    }
    assert.throws(() => openJournal(randomUUID()), /EEXIST/);
    assert.doesNotMatch(readFileSync(path, 'utf8'), /password|idToken|refreshToken/);
  })
);

test('Linux journal detects broken tail, unsafe permissions and symlink', {skip: process.platform !== 'linux'}, () =>
  isolatedHome((home) => {
    const journal = openJournal(randomUUID());
    journal.record(authUids[0], 'CREATE_UNKNOWN', {
      email: authUids[0] + '-synthetic-test@example.invalid',
    });
    journal.close();
    const root = join(home, '.oldx-phase-b-fixtures-v1');
    const path = join(root, 'journal.jsonl');
    const content = readFileSync(path, 'utf8');
    writeFileSync(path, content + '{partial');
    assert.throws(() => journalStatus(), /INCOMPLETE_JOURNAL/);
    writeFileSync(path, content);
    const other = join(home, 'link-target');
    symlinkSync(path, other);
    // Status must never follow or change an arbitrary symlink as a journal.
    rmSync(path);
    symlinkSync(other, path);
    assert.throws(() => journalStatus(), /UNSAFE_JOURNAL/);
  })
);

test('Linux journal refuses wrong evidence or premature all-absent marker', {skip: process.platform !== 'linux'}, () =>
  isolatedHome((home) => {
    const journal = fixtureJournal(home);
    journal.close();
    const path = join(home, '.oldx-phase-b-fixtures-v1', 'journal.jsonl');
    const data = readFileSync(path, 'utf8');
    writeFileSync(path, data + JSON.stringify({state: 'ALL_ABSENT_VERIFIED'}) + '\n');
    assert.throws(() => journalStatus(), /PREMATURE_JOURNAL_COMPLETION/);
    writeFileSync(path, data);
    const lines = data.trimEnd().split('\n');
    const index = lines.findIndex((line) => JSON.parse(line).state === 'CREATED_VERIFIED');
    const entry = JSON.parse(lines[index]);
    entry.evidence.createdAt = '1794614400001';
    lines[index] = JSON.stringify(entry);
    // Original journal is still well-formed; changed evidence must mismatch on delete.
    lines.push(JSON.stringify({resource: entry.resource, state: 'DELETE_UNKNOWN',
      evidence: {email: entry.evidence.email, createdAt}}));
    writeFileSync(path, lines.join('\n') + '\n');
    assert.throws(() => journalStatus(), /DELETE_EVIDENCE_MISMATCH/);
  })
);

test('Linux journal accepts a complete four-resource history but blocks a replay', {skip: process.platform !== 'linux'}, () =>
  isolatedHome((home) => {
    const journal = fixtureJournal(home);
    for (const doc of [...firestoreDocs].reverse()) {
      journal.record(doc, 'DELETE_UNKNOWN', {updateTime});
      journal.record(doc, 'DELETE_ACKNOWLEDGED');
    }
    for (const uid of authUids) {
      journal.record(uid, 'DELETE_UNKNOWN', {
        email: uid + '-synthetic-test@example.invalid', createdAt,
      });
      journal.record(uid, 'DELETE_ACKNOWLEDGED');
    }
    journal.complete();
    journal.close();
    const states = journalStatus();
    assert.equal(states.completed, true);
    assert.equal(states.size, 4);
    assert.equal(states.get(authUids[0]), 'DELETE_ACKNOWLEDGED');
    const path = join(home, '.oldx-phase-b-fixtures-v1', 'journal.jsonl');
    writeFileSync(path, readFileSync(path, 'utf8') +
      JSON.stringify({resource: authUids[0], state: 'CREATE_UNKNOWN'}) + '\n');
    assert.throws(() => journalStatus(), /ENTRY_AFTER_COMPLETION/);
  })
);
