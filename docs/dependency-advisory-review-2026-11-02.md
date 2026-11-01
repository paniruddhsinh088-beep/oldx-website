# Development dependency advisory review — 2 November 2026

Branch: `security-hardening-review`. This review does not change runtime browser
SDK references, cloud settings, credentials, live Firebase resources or billing.

## Verified baseline and changes

The baseline full npm audit reported 16 moderate development-tool advisories and
zero high/critical findings. Two vulnerable transitive libraries were replaced
through narrow parent-specific overrides, keeping the existing CLI version:

| Parent | Replacement | Why the used API is compatible |
| --- | --- | --- |
| `gaxios@6.7.1` | `uuid@11.1.1` | Its only UUID use is CommonJS `v4()` with no arguments to create multipart boundaries. The patched release preserves that API. |
| `@google-cloud/pubsub` | `@opentelemetry/core@2.8.0` | The client imports only `W3CTraceContextPropagator` from core. Its API and OpenTelemetry API peer range are preserved for the used trace-propagation path. |

Both are major transitive upgrades; they are scoped and tested rather than global
replacements. `scripts/toolchain-compat.test.mjs` resolves through the real CLI
dependency tree. It prepares an actual Gaxios multipart body and parses a synthetic
response with an injected in-memory fetch implementation, and exercises Pub/Sub
trace injection/extraction plus the disabled-propagation path without creating a
provider client or making a network call. Exact-commit emulator CI must also pass
before treating the updated CLI stack as verified.

The existing scoped Firestore `grpc-js@1.14.7` override remains unchanged.

## Latest audit result

`npm audit --json --fetch-retries=0 --fetch-timeout=20000 --cache /workspace/work/npm-cache`
reports **13 moderate, 0 high, 0 critical** and exits 1 because findings remain.
Affected-package counts include transitive cascades and are not a count of unique
independent vulnerabilities. The refreshed runtime-only audit reported zero findings and exited 0;
its exact command is recorded with the batch regression evidence.

Remaining affected development packages: archiver, archiver-utils, exegesis,
firebase-tools, gaxios, gcp-metadata, glob, google-gax, minimatch, readdir-glob,
rimraf, superstatic and zip-stream. The remaining root chains involve minimatch
glob-parts amplification and glob cancellation behavior, including several old
minimatch majors used by different consumers.

## Why no global audit fix was applied

The installed Firebase CLI uses minimatch as a callable CommonJS export in
`lib/fsAsync.js`. The patched minimatch 11 API exposes named exports instead;
globally overriding the old dependency would break that existing caller. Other
CLI consumers use their own glob/minimatch versions and option semantics. The
current upstream CLI is already 15.34.2, so no compatible upstream CLI update was
available at this review. Npm's proposed downgrade to Firebase CLI 13.11.2 would
undo earlier security work and is not an acceptable automatic fix.

These dependencies remain excluded from the explicit static browser asset list.
The repository has no public runtime/backend exposing this CLI, and the emulator
runner only accepts fixed local demo-project suites. This limits the reviewed
surface but does not erase the advisories or constitute a clean audit. Follow up
with compatible upstream releases or an explicitly scoped, integration-tested
consumer migration; do not relax input/security controls or run force audit fixes
to make the report green.
