import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { EMULATOR_TEST_PLANS, validateEmulatorTestPlan } from './emulator-test-plan.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const [name, ...extra] = process.argv.slice(2);
  if (extra.length || !Object.hasOwn(EMULATOR_TEST_PLANS, name)) throw new Error('Specify one known emulator suite.');
  const config = JSON.parse(await readFile(new URL('../' + EMULATOR_TEST_PLANS[name].config, import.meta.url), 'utf8'));
  const plan = validateEmulatorTestPlan(name, config, process.env);
  const cli = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
  const cache = fileURLToPath(new URL('../.firebase/emulators', import.meta.url));
  await mkdir(cache, { recursive: true });
  const child = spawn(process.execPath, [cli, ...plan.args], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, FIREBASE_EMULATORS_PATH: process.env.FIREBASE_EMULATORS_PATH || cache }
  });
  child.on('error', () => { console.error('Could not start the local Firebase CLI. Run npm ci first.'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
