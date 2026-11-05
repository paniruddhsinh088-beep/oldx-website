// Inactive, dependency-free location UX boundary. No geolocation runs on import.
// Wire to a reviewed user-triggered UI only; never persist a buyer's location here.
export const HIGH_ACCURACY_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30_000,
});

function coordinate(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`Invalid ${label}`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function validateDestination(latitude, longitude) {
  return Object.freeze({
    latitude: coordinate(latitude, -90, 90, 'latitude'),
    longitude: coordinate(longitude, -180, 180, 'longitude'),
  });
}

export function accuracyQuality(metres) {
  if (typeof metres !== 'number' || !Number.isFinite(metres) || metres < 0) return 'unknown';
  if (metres <= 50) return 'good';
  if (metres <= 100) return 'usable';
  return 'poor';
}

export function parsePosition(position) {
  const coords = position?.coords;
  const point = validateDestination(coords?.latitude, coords?.longitude);
  const accuracyMeters = coords?.accuracy;
  const quality = accuracyQuality(accuracyMeters);
  if (quality === 'unknown') throw new TypeError('Invalid reported accuracy');
  return Object.freeze({ ...point, accuracyMeters, quality, source: 'device' });
}

// HTTPS universal link: the OS may hand it to Maps, otherwise the web page opens.
// Do not include the buyer's origin, contact data, or arbitrary URL parameters.
export function googleMapsDirectionsUrl(latitude, longitude) {
  const point = validateDestination(latitude, longitude);
  const destination = `${point.latitude},${point.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function geolocationFailure(error) {
  if (error?.code === 1) return 'permission-denied';
  if (error?.code === 2) return 'position-unavailable';
  if (error?.code === 3) return 'timeout';
  return 'location-error';
}

// A late GPS callback cannot overwrite a manually placed pin or a newer request.
// cancel/dispose settle pending promises even if the browser never calls back.
export function createLocationPicker({ geolocation, onChange = () => {} } = {}) {
  if (typeof onChange !== 'function') throw new TypeError('onChange must be a function');
  let revision = 0;
  let selected = null;
  let pending = null;
  let disposed = false;

  function emit(view) {
    // UI observers must not strand a pending location request.
    try { onChange(view); } catch { /* caller owns its UI error handling */ }
  }

  function settlePending(status) {
    if (!pending) return;
    const previous = pending;
    pending = null;
    previous.resolve({ status });
  }

  function finish(id, outcome, view) {
    if (disposed || id !== revision || pending?.id !== id) return;
    const previous = pending;
    pending = null;
    if (outcome.status === 'selected') selected = outcome.fix;
    emit(view);
    previous.resolve(outcome);
  }

  function request() {
    if (disposed) return Promise.resolve({ status: 'disposed' });
    revision += 1;
    settlePending('superseded');
    if (typeof geolocation?.getCurrentPosition !== 'function') {
      emit({ state: 'unavailable', selected });
      return Promise.resolve({ status: 'unavailable' });
    }
    const id = revision;
    return new Promise(resolve => {
      pending = { id, resolve };
      emit({ state: 'loading', selected });
      if (disposed || id !== revision || pending?.id !== id) return;
      try {
        geolocation.getCurrentPosition(position => {
          if (disposed || id !== revision || pending?.id !== id) return;
          let fix;
          try {
            fix = parsePosition(position);
          } catch {
            finish(id, { status: 'invalid-fix' }, { state: 'invalid-fix', selected });
            return;
          }
          if (fix.quality === 'poor') {
            finish(id, { status: 'poor-accuracy', candidate: fix },
              { state: 'needs-review', candidate: fix, selected });
            return;
          }
          finish(id, { status: 'selected', fix }, { state: 'selected', selected: fix });
        }, error => {
          const status = geolocationFailure(error);
          finish(id, { status }, { state: status, selected });
        }, { ...HIGH_ACCURACY_OPTIONS });
      } catch {
        finish(id, { status: 'location-error' }, { state: 'location-error', selected });
      }
    });
  }

  function setManual(latitude, longitude) {
    if (disposed) return { status: 'disposed' };
    const point = validateDestination(latitude, longitude);
    revision += 1;
    settlePending('cancelled');
    selected = Object.freeze({ ...point, accuracyMeters: null, quality: 'manual', source: 'manual' });
    emit({ state: 'selected', selected });
    return { status: 'selected', fix: selected };
  }

  function cancel() {
    if (disposed) return;
    revision += 1;
    settlePending('cancelled');
    emit({ state: 'idle', selected });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    revision += 1;
    settlePending('cancelled');
  }

  return Object.freeze({ request, setManual, cancel, dispose, getSelected: () => selected });
}
