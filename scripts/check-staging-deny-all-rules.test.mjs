import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkStagingDenyAllRules } from './check-staging-deny-all-rules.mjs';

const baseline = readFileSync(new URL('../tests/firestore-emulator/deny-all.rules', import.meta.url), 'utf8');
const release = {name:'projects/oldx-staging/releases/cloud.firestore',rulesetName:'projects/oldx-staging/rulesets/fixture'};
const ruleset = {name:release.rulesetName,source:{files:[{content:baseline.replaceAll('\r\n','\n').replaceAll('\n','\r\n')}]}};

test('accepts the linked default staging release and fingerprints its source', () => {
  assert.match(checkStagingDenyAllRules(release, ruleset, baseline).sha256, /^[a-f0-9]{64}$/);
});

test('rejects an unrelated release, unrelated ruleset and additional source', () => {
  assert.throws(() => checkStagingDenyAllRules({...release,name:release.name+'/other'},ruleset,baseline), /default Firestore/);
  assert.throws(() => checkStagingDenyAllRules(release,{...ruleset,name:release.rulesetName+'-other'},baseline), /does not match/);
  assert.throws(() => checkStagingDenyAllRules(release,{...ruleset,source:{files:[...ruleset.source.files,{content:baseline}]}},baseline), /exactly one/);
});

test('rejects a ruleset containing any difference from the reviewed source', () => {
  assert.throws(() => checkStagingDenyAllRules(release,{...ruleset,source:{files:[{content:baseline.replace('if false','if true')}]}},baseline), /differs/);
});
