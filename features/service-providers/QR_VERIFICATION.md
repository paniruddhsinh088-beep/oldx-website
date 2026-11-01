# Service Provider QR verification — review branch only

This feature is **not deployed**. The tests below are local/CI checks, not proof
that a mobile camera can scan the result or that the public profile route exists.

## Reproduce on Node.js 20+

```sh
npm install --package-lock=false --ignore-scripts --no-audit --no-fund
npm run test:service-providers
```

The test suite now includes:
- strict OLDX public profile URL validation
- offline QR matrix creation using the real `qrcode` package
- SVG encoder output accepted by the QR SVG safety filter
- SVG injection rejection
- Share Card + QR bundle creation
- browser click/download adapters tested with injected fake DOM APIs

## Manual acceptance gate (before release)

1. On a review-only build, create a test provider profile with no private data.
2. Generate its QR with the real offline library.
3. Download the QR SVG on Android and desktop; confirm both files open.
4. Scan using Android camera and a second QR reader; verify the decoded URL is
   exactly `https://oldxbazar.in/services/provider/<test-provider-id>`.
5. Verify the URL only resolves to the intended *public* provider profile when
   the route is actually implemented and deployed under separate approval.
6. Verify Share Card contains no phone number, UID or private fields.
7. Test Chrome/Android handling of two sequential downloads; some browsers may
   block one of them. Provide separate download controls if necessary.

Do not bypass failed tests, change live Firebase rules, enable Storage billing,
or deploy without owner approval. GitHub Actions status must be inspected
separately; an empty PR-filtered workflow-run query is not a passing result.
