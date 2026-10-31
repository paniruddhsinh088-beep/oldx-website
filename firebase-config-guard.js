/*
 * OLDX Firebase environment guard.
 *
 * This file intentionally contains NO Firebase credentials/configuration.
 * The hosting/deployment layer must define window.OLDX_FIREBASE_CONFIG before
 * this file loads. Do not select environments from query strings or user input.
 *
 * Required shape:
 * window.OLDX_FIREBASE_CONFIG = {
 *   environment: "staging" | "production",
 *   projectId: "...",
 *   apiKey: "...",
 *   authDomain: "...",
 *   storageBucket: "...",
 *   messagingSenderId: "...",
 *   appId: "..."
 * };
 */
(function (window) {
    "use strict";

    const config = window.OLDX_FIREBASE_CONFIG;
    if (!config || typeof config !== "object") {
        throw new Error("OLDX Firebase configuration is missing. Refusing to initialize.");
    }

    const expectedProjects = {
        staging: "oldx-staging",
        production: "oldx-1c983"
    };

    if (!Object.prototype.hasOwnProperty.call(expectedProjects, config.environment)) {
        throw new Error("Unknown OLDX environment. Refusing to initialize.");
    }

    if (config.projectId !== expectedProjects[config.environment]) {
        throw new Error("OLDX Firebase project does not match selected environment. Refusing to initialize.");
    }

    const requiredFields = [
        "apiKey",
        "authDomain",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId"
    ];

    for (const field of requiredFields) {
        if (typeof config[field] !== "string" || config[field].trim() === "") {
            throw new Error("OLDX Firebase configuration is missing field: " + field);
        }
    }

    // Expose a frozen copy; never silently fall back to production.
    window.OLDX_FIREBASE_CONFIG = Object.freeze({ ...config });

    if (config.environment === "staging") {
        document.documentElement.setAttribute("data-oldx-environment", "staging");
        console.info("[OLDX] Staging environment selected:", config.projectId);
    }
})(window);
