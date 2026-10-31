/**
 * Fail-closed configuration guard for the future OLDX Admin backend.
 * This module performs no network calls and provisions no cloud resources.
 */
const REQUIRED = ["OLDX_BACKEND_ENV", "OLDX_FIREBASE_PROJECT_ID"];

export function validateBackendConfig(env = {}) {
  const missing = REQUIRED.filter((key) => typeof env[key] !== "string" || !env[key].trim());
  if (missing.length) {
    throw new Error(`Missing required backend configuration: ${missing.join(", ")}`);
  }

  if (env.OLDX_BACKEND_ENV !== "staging") {
    throw new Error("Admin backend may run only in staging in this review phase");
  }
  if (env.OLDX_FIREBASE_PROJECT_ID !== "oldx-staging") {
    throw new Error("Refusing to start: Firebase project is not the approved staging project");
  }

  return Object.freeze({
    environment: "staging",
    projectId: "oldx-staging"
  });
}
