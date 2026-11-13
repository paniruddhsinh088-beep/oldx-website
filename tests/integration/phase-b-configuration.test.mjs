import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectPhaseBConfiguration} from '../../scripts/phase-b-fixture-session-v1.mjs';

const service = 'oldx-owner-read';
const runtime = 'oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com';
const invoker = 'oldx-phase-b-invoker@oldx-staging.iam.gserviceaccount.com';
const main = service + '-00001-8kr';
const health = service + '-00002-tid';
const role = (name) => 'projects/oldx-staging/roles/' + name;
const responses = {
  'projects describe oldx-staging': {projectId: 'oldx-staging', projectNumber: '38472235077'},
  'iam roles describe oldxProductReadFirestore': {
    name: role('oldxProductReadFirestore'), stage: 'ALPHA',
    includedPermissions: ['datastore.entities.update', 'datastore.entities.get',
      'datastore.databases.get', 'datastore.entities.create'],
  },
  'iam roles describe oldxProductReadAuth': {
    name: role('oldxProductReadAuth'), stage: 'ALPHA', includedPermissions: ['firebaseauth.users.get'],
  },
  ['iam service-accounts describe ' + runtime]: {email: runtime, projectId: 'oldx-staging'},
  'projects get-iam-policy oldx-staging': {etag: 'fixture', bindings: [
    {role: role('oldxProductReadAuth'), members: ['serviceAccount:' + runtime]},
    {role: role('oldxProductReadFirestore'), members: ['serviceAccount:' + runtime], condition: {
      title: 'OLDX_Staging_Default_DB_Only', expression: 'resource.name == "projects/oldx-staging/databases/(default)"',
    }},
  ]},
  ['iam service-accounts describe ' + invoker]: {email: invoker, projectId: 'oldx-staging'},
  ['iam service-accounts get-iam-policy ' + invoker]: {etag: 'fixture', bindings: [
    {role: 'roles/iam.serviceAccountOpenIdTokenCreator', members: ['user:yasminparmar087@gmail.com']},
  ]},
  ['run services get-iam-policy ' + service]: {etag: 'fixture', bindings: [
    {role: 'roles/run.invoker', members: ['serviceAccount:' + invoker]},
  ]},
  ['run services describe ' + service]: {
    metadata: {name: service, namespace: '38472235077', annotations: {'run.googleapis.com/ingress': 'all'}},
    spec: {template: {spec: {serviceAccountName: runtime}}},
    status: {traffic: [{revisionName: main, percent: 100}, {revisionName: health, tag: 'healthcheck'}]},
  },
  ...Object.fromEntries([main, health].map((revision) => ['run revisions describe ' + revision, {
    metadata: {name: revision, labels: {'serving.knative.dev/service': service}},
    spec: {serviceAccountName: runtime, containers: [{}]},
  }])),
};

function fakeRead(mutate = () => {}) {
  return (...args) => {
    if (args[0] === 'config') return 'oldx-staging';
    if (args[0] === 'auth') return 'yasminparmar087@gmail.com';
    const command = args.filter((part) => !part.startsWith('--')).join(' ');
    assert.ok(args.includes('--project=oldx-staging') && args.includes('--format=json'));
    assert.ok(Object.hasOwn(responses, command));
    const data = structuredClone(responses[command]);
    mutate(command, data);
    return JSON.stringify(data);
  };
}

test('matching fixed configuration leaves effective IAM, invocation and release unresolved', () => {
  const report = inspectPhaseBConfiguration(fakeRead());
  assert.equal(report.configuration, 'MATCH');
  assert.equal(report.effectiveDatabaseIam, 'UNVERIFIED');
  assert.equal(report.leastPrivilegeInvoker, 'UNVERIFIED');
  assert.equal(report.stagingExecution, 'NO_GO');
  assert.equal(report.ingress, 'INTERNET_REACHABLE');
  assert.ok(!JSON.stringify(report).includes(runtime));
  assert.ok(!JSON.stringify(report).includes(invoker));
});

test('wrong local project stops before cloud configuration commands', () => {
  const commands = [];
  const report = inspectPhaseBConfiguration((...args) => {
    commands.push(args[0]);
    return args[0] === 'config' ? 'different-project' : 'yasminparmar087@gmail.com';
  });
  assert.deepEqual(commands, ['config', 'auth']);
  assert.equal(report.configuration, 'BLOCKED');
});

test('public binding, IAM bypass, changed condition, traffic drift or failed read blocks configuration', () => {
  const cases = [
    ['servicePolicy', 'run services get-iam-policy', (data) => { delete data.bindings; }],
    ['projectPolicy', 'projects get-iam-policy', (data) => {
      data.bindings.push({role: 'roles/run.invoker', members: ['serviceAccount:' + invoker]});
    }],
    ['invokerTokenPolicy', 'iam service-accounts get-iam-policy', (data) => {
      data.bindings[0].role = 'roles/iam.serviceAccountTokenCreator';
    }],
    ['servicePolicy', 'run services get-iam-policy', (data) => {
      data.bindings = [{role: 'roles/run.invoker', members: ['allUsers']}];
    }],
    ['serviceAndTraffic', 'run services describe', (data) => {
      data.metadata.annotations['run.googleapis.com/invoker-iam-disabled'] = 'true';
    }],
    ['projectPolicy', 'projects get-iam-policy', (data) => { delete data.bindings[1].condition; }],
    ['serviceAndTraffic', 'run services describe', (data) => { data.status.traffic[0].percent = 99; }],
    ['runtimeIdentity', 'iam service-accounts describe', () => { throw new Error('private detail'); }],
    [main, 'run revisions describe ' + main, (data) => {
      data.spec.containers[0].env = [{name: 'OLDX_PRODUCT_READ_ACTIVATE_STAGING', value: 'true'}];
    }],
  ];
  for (const [check, prefix, patch] of cases) {
    const report = inspectPhaseBConfiguration(fakeRead((command, data) => {
      if (command.startsWith(prefix)) patch(data);
    }));
    assert.equal(report.configuration, check === 'runtimeIdentity' ? 'BLOCKED' : 'FAIL');
    assert.notEqual(report.checks[check], 'MATCH');
    assert.ok(!JSON.stringify(report).includes('private detail'));
  }
});
