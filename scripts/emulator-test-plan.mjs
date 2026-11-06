// Fixed local test plans. Never accept arbitrary CLI options or project names.
export const EMULATOR_TEST_PLANS = Object.freeze({
  'admin-runtime': Object.freeze({service:'firestore',project:'demo-oldx-admin-runtime',config:'firebase.admin-runtime-emulator.json',rules:'tests/firestore-emulator/deny-all.rules',port:8088,authPort:9098,tests:['tests/firestore-emulator/admin-runtime-native.test.mjs']}),
  baseline: Object.freeze({
    service: 'firestore', project: 'demo-oldx-emulator', config: 'firebase.emulator.json',
    rules: 'tests/firestore-emulator/deny-all.rules', port: 8080,
    tests: ['tests/firestore-emulator/rules-runtime.test.mjs', 'tests/firestore-emulator/admin-atomic-audit.test.mjs', 'tests/firestore-emulator/staging-readiness-runtime.test.mjs', 'tests/firestore-emulator/migration-rehearsal-runtime.test.mjs', 'tests/firestore-emulator/legacy-performance-runtime.test.mjs', 'tests/firestore-emulator/product-read-state-runtime.test.mjs', 'tests/firestore-emulator/provider-read-state-runtime.test.mjs']
  }),
  'product-drafts': Object.freeze({
    service: 'firestore', project: 'demo-oldx-product-drafts', config: 'firebase.product-drafts-emulator.json',
    rules: 'tests/firestore-emulator/product-owner-drafts.candidate.rules', port: 8086,
    tests: ['tests/firestore-emulator/product-owner-drafts-runtime.test.mjs']
  }),
  storage: Object.freeze({
    service: 'storage', project: 'demo-oldx-storage', config: 'firebase.storage-emulator.json',
    rules: 'tests/storage-emulator/candidate.rules', port: 9199,
    tests: ['tests/storage-emulator/rules-runtime.test.mjs']
  }),
  'chat-private-state': Object.freeze({
    service: 'firestore', project: 'demo-oldx-chat-private-state', config: 'firebase.chat-private-user-state-emulator.json',
    rules: 'tests/firestore-emulator/chat-private-user-state.candidate.rules', port: 8080,
    tests: ['tests/firestore-emulator/chat-private-user-state-runtime.test.mjs']
  }),
  'service-providers': Object.freeze({
    service: 'firestore', project: 'demo-oldx-service-providers', config: 'firebase.service-providers-emulator.json',
    rules: 'tests/firestore-emulator/service-providers-candidate.rules', port: 8084,
    tests: ['tests/firestore-emulator/service-providers-candidate-runtime.test.mjs']
  })
});

export function validateEmulatorTestPlan(name, config, env = {}) {
  if (!Object.hasOwn(EMULATOR_TEST_PLANS, name)) throw new Error('Unknown emulator test suite.');
  const plan = EMULATOR_TEST_PLANS[name];
  const sameKeys = (record, keys) => record && typeof record === 'object' && !Array.isArray(record)
    && Object.keys(record).sort().join(',') === [...keys].sort().join(',');
  if (!sameKeys(config, [plan.service, 'emulators']) ||
      !sameKeys(config[plan.service], ['rules']) || config[plan.service].rules !== plan.rules ||
      !sameKeys(config.emulators, [plan.service, ...(plan.authPort?['auth']:[]), 'ui', 'singleProjectMode']) ||
      !sameKeys(config.emulators[plan.service], ['host', 'port']) ||
      config.emulators[plan.service].host !== '127.0.0.1' ||
      config.emulators[plan.service].port !== plan.port ||
      plan.authPort && (!sameKeys(config.emulators.auth,['host','port']) || config.emulators.auth.host!=='127.0.0.1' || config.emulators.auth.port!==plan.authPort) ||
      !sameKeys(config.emulators.ui, ['enabled']) || config.emulators.ui.enabled !== false ||
      config.emulators.singleProjectMode !== true) {
    throw new Error('Emulator config must match the isolated loopback-only test plan.');
  }
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (env[key] && env[key] !== plan.project) throw new Error('Live or mismatched project environment refused.');
  }
  for (const [key, service] of [['FIRESTORE_EMULATOR_HOST', 'firestore'], ['FIREBASE_STORAGE_EMULATOR_HOST', 'storage']]) {
    if (env[key] && (service !== plan.service || env[key] !== `127.0.0.1:${plan.port}`)) {
      throw new Error('Non-loopback or mismatched emulator host refused.');
    }
  }
  if(env.FIREBASE_AUTH_EMULATOR_HOST&&(!plan.authPort||env.FIREBASE_AUTH_EMULATOR_HOST!==`127.0.0.1:${plan.authPort}`))throw new Error('Non-loopback Auth emulator refused.');
  return {
    ...plan,
    args: ['emulators:exec', '--only', plan.authPort?'firestore,auth':plan.service, '--project', plan.project,
      '--config', plan.config, `node --test ${plan.tests.join(' ')}`]
  };
}
