import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EMULATOR_TEST_PLANS, validateEmulatorTestPlan } from './emulator-test-plan.mjs';

for (const [name, plan] of Object.entries(EMULATOR_TEST_PLANS)) {
  const config = JSON.parse(await readFile(new URL('../' + plan.config, import.meta.url), 'utf8'));
  test(`${name} only launches its demo project, isolated rules and tests`, () => {
    const result = validateEmulatorTestPlan(name, config);
    assert.equal(result.project.startsWith('demo-oldx-'), true);
    assert.deepEqual(result.args.slice(0, 7), ['emulators:exec', '--only', plan.service, '--project', plan.project, '--config', plan.config]);
  });
  test(`${name} refuses live project/remote host and unsafe config before CLI startup`, () => {
    for (const env of [
      { GCLOUD_PROJECT: 'oldx-1c983' }, { GOOGLE_CLOUD_PROJECT: 'oldx-staging' },
      { FIRESTORE_EMULATOR_HOST: 'example.com:8080' }, { FIREBASE_STORAGE_EMULATOR_HOST: '0.0.0.0:9199' }
    ]) assert.throws(() => validateEmulatorTestPlan(name, config, env));
    for (const mutate of [
      value => { value.emulators[plan.service].host = '0.0.0.0'; },
      value => { value[plan.service].rules = 'firestore.rules'; },
      value => { value.hosting = { public: 'public' }; },
      value => { value.emulators.functions = { port: 5001 }; },
      value => { value.emulators.singleProjectMode = false; }
    ]) {
      const bad = structuredClone(config); mutate(bad);
      assert.throws(() => validateEmulatorTestPlan(name, bad));
    }
  });
}

test('unknown suites and prototype property names are rejected', () => {
  for (const name of ['production', '--project', 'toString', '__proto__']) {
    assert.throws(() => validateEmulatorTestPlan(name, {}));
  }
});
