/*
 * Copy this file to firebase-env.js in the DEPLOYMENT artifact only.
 * Never deploy this placeholder file.
 *
 * Staging artifact:
 *   environment: "staging"
 *   projectId: "oldx-staging"
 *   Fill the remaining values from Firebase Console > Project settings > Web app.
 *
 * Production artifact:
 *   environment: "production"
 *   projectId: "oldx-1c983"
 *   Use the existing production web-app values without modification.
 *
 * Keep separate staging and production deployment artifacts. Do not select
 * environment from URL parameters, localStorage, or user-controlled input.
 * This is public browser configuration, not a place for service-account keys.
 */
window.OLDX_FIREBASE_CONFIG = {
    environment: "REPLACE_WITH_staging_OR_production",
    apiKey: "REPLACE_FROM_FIREBASE_WEB_APP_CONFIG",
    authDomain: "REPLACE_FROM_FIREBASE_WEB_APP_CONFIG",
    projectId: "REPLACE_WITH_EXPECTED_PROJECT_ID",
    storageBucket: "REPLACE_FROM_FIREBASE_WEB_APP_CONFIG",
    messagingSenderId: "REPLACE_FROM_FIREBASE_WEB_APP_CONFIG",
    appId: "REPLACE_FROM_FIREBASE_WEB_APP_CONFIG"
};
