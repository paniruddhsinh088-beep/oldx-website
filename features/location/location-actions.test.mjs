import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HIGH_ACCURACY_OPTIONS, accuracyQuality, parsePosition, validateDestination,
  googleMapsDirectionsUrl, createLocationPicker,
} from './location-actions.mjs';

const fix = (latitude = 23.03, longitude = 72.58, accuracy = 35) => ({
  coords: { latitude, longitude, accuracy },
});

function controlledGeolocation() {
  const calls = [];
  return {
    calls,
    getCurrentPosition(success, failure, options) { calls.push({ success, failure, options }); },
  };
}

test('strict coordinate boundaries reject coercion and unsafe numbers', () => {
  assert.deepEqual(validateDestination(-90, 180), { latitude: -90, longitude: 180 });
  assert.deepEqual(validateDestination(-0, -0), { latitude: 0, longitude: 0 });
  for (const pair of [[91, 0], [-91, 0], [0, 181], [0, -181], ['23', 72], [NaN, 0], [0, Infinity], [null, 0]]) {
    assert.throws(() => validateDestination(...pair), TypeError);
  }
});

test('quality is measured, not an exact GPS guarantee', () => {
  assert.equal(accuracyQuality(0), 'good');
  assert.equal(accuracyQuality(50), 'good');
  assert.equal(accuracyQuality(51), 'usable');
  assert.equal(accuracyQuality(100), 'usable');
  assert.equal(accuracyQuality(100.01), 'poor');
  for (const value of [-1, NaN, Infinity, null, '10']) assert.equal(accuracyQuality(value), 'unknown');
  assert.equal(parsePosition(fix()).accuracyMeters, 35);
  assert.throws(() => parsePosition({ coords: { latitude: 23, longitude: 72 } }), TypeError);
});

test('Maps handoff is a fixed HTTPS directions URL without buyer origin or untrusted parameters', () => {
  assert.equal(googleMapsDirectionsUrl(23.03, 72.58),
    'https://www.google.com/maps/dir/?api=1&destination=23.03%2C72.58');
  const url = new URL(googleMapsDirectionsUrl(-90, 180));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'www.google.com');
  assert.equal(url.searchParams.get('destination'), '-90,180');
  assert.deepEqual([...url.searchParams.keys()], ['api', 'destination']);
  assert.throws(() => googleMapsDirectionsUrl('23,72', 72), TypeError);
});

test('GPS is only requested by an explicit request and receives high accuracy options', async () => {
  const geo = controlledGeolocation();
  const states = [];
  const picker = createLocationPicker({ geolocation: geo, onChange: x => states.push(x.state) });
  assert.equal(geo.calls.length, 0);
  const pending = picker.request();
  assert.deepEqual(geo.calls[0].options, HIGH_ACCURACY_OPTIONS);
  geo.calls[0].success(fix());
  assert.equal((await pending).status, 'selected');
  assert.equal(picker.getSelected().quality, 'good');
  assert.deepEqual(states, ['loading', 'selected']);
});

test('poor accuracy is a candidate, never silently replaces a selected manual pin', async () => {
  const geo = controlledGeolocation();
  const picker = createLocationPicker({ geolocation: geo });
  picker.setManual(22, 73);
  const pending = picker.request();
  geo.calls[0].success(fix(23, 72, 250));
  assert.equal((await pending).status, 'poor-accuracy');
  assert.equal(picker.getSelected().latitude, 22);
  assert.equal(picker.getSelected().source, 'manual');
});

test('manual pin wins over late GPS and settles pending request', async () => {
  const geo = controlledGeolocation();
  const picker = createLocationPicker({ geolocation: geo });
  const pending = picker.request();
  picker.setManual(21, 70);
  assert.equal((await pending).status, 'cancelled');
  geo.calls[0].success(fix());
  assert.equal(picker.getSelected().latitude, 21);
});

test('superseded GPS callback cannot replace newer fix', async () => {
  const geo = controlledGeolocation();
  const picker = createLocationPicker({ geolocation: geo });
  const first = picker.request();
  const second = picker.request();
  assert.equal((await first).status, 'superseded');
  geo.calls[0].success(fix(1, 1));
  geo.calls[1].success(fix(2, 2));
  assert.equal((await second).fix.latitude, 2);
});

test('permission denial, timeout, unsupported browser and invalid fixes fail safely', async () => {
  const geo = controlledGeolocation();
  const picker = createLocationPicker({ geolocation: geo });
  const denied = picker.request();
  geo.calls[0].failure({ code: 1 });
  assert.equal((await denied).status, 'permission-denied');
  const timed = picker.request();
  geo.calls[1].failure({ code: 3 });
  assert.equal((await timed).status, 'timeout');
  const invalid = picker.request();
  geo.calls[2].success(fix(1000, 0));
  assert.equal((await invalid).status, 'invalid-fix');
  assert.equal(picker.getSelected(), null);
  assert.equal((await createLocationPicker().request()).status, 'unavailable');
});

test('cancel and dispose settle pending promises; callbacks after disposal are ignored', async () => {
  const geo = controlledGeolocation();
  const states = [];
  const picker = createLocationPicker({ geolocation: geo, onChange: x => states.push(x.state) });
  const first = picker.request();
  picker.cancel();
  assert.equal((await first).status, 'cancelled');
  const second = picker.request();
  picker.dispose();
  assert.equal((await second).status, 'cancelled');
  const count = states.length;
  geo.calls[1].success(fix());
  assert.equal(states.length, count);
  assert.equal((await picker.request()).status, 'disposed');
  assert.equal(picker.getSelected(), null);
});

test('synchronous geolocation failure is sanitized', async () => {
  const picker = createLocationPicker({ geolocation: {
    getCurrentPosition() { throw new Error('private device detail'); },
  } });
  assert.deepEqual(await picker.request(), { status: 'location-error' });
});

test('throwing UI observer does not leave request pending', async () => {
  const geo = controlledGeolocation();
  const picker = createLocationPicker({ geolocation: geo, onChange() { throw Error('render failed'); } });
  const pending = picker.request();
  geo.calls[0].success(fix());
  assert.equal((await pending).status, 'selected');
});

test('manual selection during loading notification prevents starting stale GPS', async () => {
  const geo = controlledGeolocation();
  let picker;
  picker = createLocationPicker({ geolocation: geo, onChange(view) {
    if (view.state === 'loading') picker.setManual(20, 71);
  } });
  assert.equal((await picker.request()).status, 'cancelled');
  assert.equal(geo.calls.length, 0);
  assert.equal(picker.getSelected().latitude, 20);
});
