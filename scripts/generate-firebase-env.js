"use strict";

// Vercel build helper. It generates a browser config from explicitly scoped
// environment variables. Never place service-account credentials here.
const fs = require("fs");
const path = require("path");

const environment = process.env.OLDX_FIREBASE_ENV;
const expectedProjects = {
  staging: "oldx-staging",
  production: "oldx-1c983"
};

if (!Object.prototype.hasOwnProperty.call(expectedProjects, environment)) {
  throw new Error("OLDX_FIREBASE_ENV must be exactly 'staging' or 'production'.");
}

const fields = {
  apiKey: process.env.OLDX_FIREBASE_API_KEY,
  authDomain: process.env.OLDX_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.OLDX_FIREBASE_PROJECT_ID,
  storageBucket: process.env.OLDX_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.OLDX_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.OLDX_FIREBASE_APP_ID
};

for (const [name, value] of Object.entries(fields)) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Missing required Vercel environment variable for Firebase field: " + name);
  }
}

// Vercel exposes the deployment target separately from the Firebase
// selector. When present, require the two scopes to agree so a misconfigured
// Preview/Production deployment fails closed. Local builds may omit VERCEL_ENV.
const vercelEnvironment = process.env.VERCEL_ENV;
const requiredFirebaseEnvironment = {
  preview: "staging",
  production: "production"
}[vercelEnvironment];

if (vercelEnvironment && !["development", "preview", "production"].includes(vercelEnvironment)) {
  throw new Error("VERCEL_ENV must be development, preview, or production when provided.");
}

if (requiredFirebaseEnvironment && environment !== requiredFirebaseEnvironment) {
  throw new Error("Firebase environment does not match VERCEL_ENV. Build refused.");
}

if (fields.projectId !== expectedProjects[environment]) {
  throw new Error("Firebase project ID does not match OLDX_FIREBASE_ENV. Build refused.");
}

const config = { environment, ...fields };
const output = '"use strict";\nwindow.OLDX_FIREBASE_CONFIG = Object.freeze(' +
  JSON.stringify(config) + ');\n';

fs.writeFileSync(path.join(process.cwd(), "firebase-env.js"), output, {
  encoding: "utf8",
  flag: "w"
});

console.log("[OLDX] Generated Firebase browser config for " + environment +
  " (" + fields.projectId + ").");
