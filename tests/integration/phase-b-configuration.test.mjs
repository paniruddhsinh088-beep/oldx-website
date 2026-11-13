import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectPhaseBConfiguration, inspectPhaseBPreflight} from '../../scripts/phase-b-fixture-session-v1.mjs';

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
  assert.equal(report.checks.projectPolicy, 'MATCH');
  assert.equal(report.checks.servicePolicy, 'MATCH');
  assert.deepEqual(report.projectPolicy, {directInvokerBindings: 0, publicBindings: 0});
  assert.deepEqual(report.servicePolicy, {directInvokerBindings: 1, publicBindings: 0});
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
    ['servicePolicy', 'run services get-iam-policy', (data) => {
      data.bindings[0].members = ['serviceAccount:' + runtime];
    }],
    ['servicePolicy', 'run services get-iam-policy', (data) => {
      data.bindings[0].condition = {expression: 'true'};
    }],
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

function preflightRead(mutate = () => {}) {
  return (...args) => {
    if (args[0] === 'services') {
      assert.deepEqual(args, ['services', 'list', '--enabled',
        '--filter=config.name~^iamcredentials[.]googleapis[.]com$',
        '--project=oldx-staging', '--account=yasminparmar087@gmail.com', '--quiet',
        '--format=value(config.name)']);
      const data = ['iamcredentials.googleapis.com'];
      mutate('api', data);
      return data.join('\n');
    }
    if (args[2] === 'keys') {
      const data = [{keyType: 'SYSTEM_MANAGED', name: 'private-key-metadata-id'}];
      mutate('keys', data);
      return JSON.stringify(data);
    }
    return fakeRead((command, data) => {
      if (command.startsWith('run services describe')) {
        data.status.url = 'https://oldx-owner-read-lqpaz3pd5a-el.a.run.app';
        data.status.latestReadyRevisionName = health;
        data.status.traffic[1].url = 'https://healthcheck---oldx-owner-read-lqpaz3pd5a-el.a.run.app';
      }
      mutate(command, data);
    })(...args);
  };
}

test('consolidated preflight only sends one anonymous GET and leaves effective access unverified', async () => {
  let calls = 0;
  const report = await inspectPhaseBPreflight(preflightRead(), (url, options) => {
    calls++;
    assert.equal(url, 'https://healthcheck---oldx-owner-read-lqpaz3pd5a-el.a.run.app/health');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    return new Response(null, {status: 403});
  });
  assert.equal(calls, 1);
  assert.equal(report.configuration, 'MATCH');
  assert.equal(report.anonymousDenial.result, 'MATCH');
  assert.equal(report.effectiveTokenMintPermission, 'UNVERIFIED');
  assert.equal(report.effectiveDatabaseIam, 'UNVERIFIED');
  assert.equal(report.stagingExecution, 'NO_GO');
  assert.deepEqual(report.runtimeKeys, {userManaged: 0, systemManaged: 1});
  assert.ok(!JSON.stringify(report).includes('private-key-metadata-id'));
});

test('operator mismatch, missing API, key drift, wrong audience and broader Firestore permissions block HTTP', async () => {
  for (const [match, patch, check] of [
    ['api', (data) => { data.pop(); }, 'iamCredentialsApi'],
    ['keys', (data) => { data.push({keyType: 'USER_MANAGED'}); }, 'runtimeKeys'],
    ['run services describe', (data) => {
      data.status.url = 'https://oldx-owner-read-38472235077.asia-south1.run.app';
    }, 'serviceAudience'],
    ['run services describe', (data) => {
      data.status.traffic[1].url = 'https://healthcheck---oldx-owner-read-38472235077.asia-south1.run.app';
    }, 'taggedUrl'],
    ['iam roles describe oldxProductReadFirestore', (data) => {
      data.includedPermissions.push('datastore.entities.delete');
    }, 'oldxProductReadFirestore'],
  ]) {
    const report = await inspectPhaseBPreflight(preflightRead((command, data) => {
      if (command.startsWith(match)) patch(data);
    }), () => assert.fail('Unexpected HTTP'));
    assert.equal(report.checks[check], 'MISMATCH');
    assert.equal(report.anonymousDenial.reason, 'CONFIGURATION_NOT_MATCHED');
    assert.ok(report.anonymousDenial.blockingChecks.some((item) =>
      item.check === check && item.status === 'MISMATCH'));
  }
  const report = await inspectPhaseBPreflight((...args) => {
    if (args[0] === 'config') return 'oldx-staging';
    assert.equal(args[0], 'auth');
    return 'other@example.invalid';
  }, () => assert.fail('Unexpected HTTP'));
  assert.equal(report.checks.operatorAndProject, 'MISMATCH');
});

test('anonymous denial status and body are classified without exposing body contents', async () => {
  for (const [response, body] of [
    [new Response('private detail', {status: 403, headers: {'content-type': 'text/html'}}), 'NONEMPTY'],
    [new Response(null, {status: 200}), 'EMPTY'],
  ]) {
    const report = await inspectPhaseBPreflight(preflightRead(), () => response);
    assert.equal(report.anonymousDenial.result, 'BLOCKED');
    assert.equal(report.anonymousDenial.httpStatus, response.status);
    assert.equal(report.anonymousDenial.body, body);
    assert.ok(!JSON.stringify(report).includes('private detail'));
  }
});

test('enabled-only API lookup distinguishes empty, failed and malformed results', async () => {
  for (const [patch, expected] of [
    [(data) => { data.pop(); }, 'MISMATCH'],
    [() => { throw new Error('private upstream detail'); }, 'UNAVAILABLE'],
    [(data) => { data.push(data[0]); }, 'UNAVAILABLE'],
    [(data) => { data[0] = 'other.googleapis.com'; }, 'UNAVAILABLE'],
  ]) {
    let requests = 0;
    const report = await inspectPhaseBPreflight(preflightRead((command, data) => {
      if (command === 'api') patch(data);
    }), () => { requests++; });
    assert.equal(report.checks.iamCredentialsApi, expected);
    assert.equal(report.anonymousDenial.reason, 'CONFIGURATION_NOT_MATCHED');
    assert.equal(requests, 0);
    assert.doesNotMatch(JSON.stringify(report), /private upstream detail|other\.googleapis/);
  }
});

test('owner service-name output matches with LF or CRLF and the wrong project never lists services', async () => {
  for (const stdout of ['iamcredentials.googleapis.com\n', '  iamcredentials.googleapis.com\r\n']) {
    const fallback = preflightRead();
    const report = inspectPhaseBConfiguration((...args) =>
      args[0] === 'services' ? stdout : fallback(...args), {preflight: true});
    assert.equal(report.checks.iamCredentialsApi, 'MATCH');
  }
  const calls = [];
  const report = inspectPhaseBConfiguration((...args) => {
    calls.push(args[0]);
    return args[0] === 'config' ? 'wrong-project' : 'yasminparmar087@gmail.com';
  }, {preflight: true});
  assert.deepEqual(calls, ['config', 'auth']);
  assert.equal(report.configuration, 'BLOCKED');
});

test('anonymous denial status, redirect and Google Frontend hints cannot qualify an unknown body', async () => {
  for (const status of [200, 401, 404, 500, 503]) {
    const report = await inspectPhaseBPreflight(preflightRead(), () => new Response(null, {status}));
    assert.equal(report.anonymousDenial.result, 'BLOCKED');
  }
  const report = await inspectPhaseBPreflight(preflightRead(), () => new Response('<html>Forbidden</html>', {
    status: 403, headers: {'content-type': 'text/html', server: 'Google Frontend'},
  }));
  assert.equal(report.anonymousDenial.result, 'BLOCKED');
  assert.equal(report.anonymousDenial.serverHint, 'GOOGLE_FRONTEND');
  assert.doesNotMatch(JSON.stringify(report), /<html>/);
  const redirected = new Response(null, {status: 403});
  Object.defineProperty(redirected, 'redirected', {value: true});
  assert.equal((await inspectPhaseBPreflight(preflightRead(), () => redirected)).anonymousDenial.result, 'BLOCKED');
});
