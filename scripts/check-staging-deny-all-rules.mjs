import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const releaseName = 'projects/oldx-staging/releases/cloud.firestore';
const normalize = source => source.replaceAll('\r\n', '\n').trim();

export function checkStagingDenyAllRules(release, ruleset, baseline) {
  if (release?.name !== releaseName) throw Error('Expected the oldx-staging default Firestore release.');
  if (!/^projects\/oldx-staging\/rulesets\/[A-Za-z0-9_-]+$/.test(release.rulesetName ?? '') ||
      ruleset?.name !== release.rulesetName) throw Error('Ruleset does not match the published release.');
  const files = ruleset.source?.files;
  if (!Array.isArray(files) || files.length !== 1 || typeof files[0]?.content !== 'string') {
    throw Error('Expected exactly one published source file.');
  }
  const source = files[0].content;
  if (normalize(source) !== normalize(baseline)) throw Error('Published source differs from the reviewed deny-all baseline.');
  return { release: release.name, ruleset: ruleset.name, sha256: createHash('sha256').update(source).digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw Error('Provide the saved release JSON and ruleset JSON.');
    const [release, ruleset] = process.argv.slice(2).map(file => {
      try { return JSON.parse(readFileSync(file, 'utf8')); }
      catch { throw Error('Could not read a saved JSON response.'); }
    });
    const baseline = readFileSync(new URL('../tests/firestore-emulator/deny-all.rules', import.meta.url), 'utf8');
    console.log(JSON.stringify(checkStagingDenyAllRules(release, ruleset, baseline)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
