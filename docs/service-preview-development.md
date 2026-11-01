# Service preview development

This is an isolated, Gujarati UI prototype with synthetic providers. It does not
authenticate, access Firebase, publish profiles, save drafts, send enquiries,
collect phone numbers, upload media or enable contact actions.

## Modules

- `service-preview.html`: labelled form, discovery, profile and demo notices.
- `features/service-providers/service-preview.mjs`: safe DOM rendering, local
  search/filtering, focus restoration and form interaction.
- `preview-fixtures.mjs`: explicitly synthetic provider examples.
- `preview-draft.mjs`: pure field errors and completion state using the shared
  profile/service normalizers. Identity, privileges and private extras are never
  copied into the preview profile.
- `provider-contact-policy.mjs`: separate pure contact-policy model. WhatsApp
  needs its own consent and public-number flag; omitted flags default off. This
  model is not wired to the preview or a trusted backend.
- `scripts/build-static-assets.mjs`: explicit allowlist for the browser package,
  including all preview imports and excluding server/moderation code and private
  artifacts. It recreates only the generated, ignored `public/` directory after
  validating all input files. The build performs no deployment.

## Verification

Install the locked dependencies with `npm ci --ignore-scripts --no-audit --no-fund`.
Run:

```sh
npm run test:service-providers
npm run test:service-preview
npm run test:static-build
npm run test:service-preview:browser
```

Browser tests use an installed Chromium (`/usr/bin/chromium` by default; set
`CHROMIUM_PATH` for another local Chrome/Chromium executable). `playwright-core`
does not download a browser. The test server binds only to loopback and exposes
only the isolated preview and its five pure modules. Every remote browser request
is blocked and asserted absent. Tests cover 320/390/768/1280px layouts, compound
filters/empty/reset states, labels, focus restoration, invalid/fractional numeric
input, multiple services, independent consent, non-persistence and markup text.

The Gujarati UI remains a prototype, not completed three-language localization.
English/Hindi catalogs, human translation review, real search pagination,
authentication, trusted contact/enquiry APIs, media and end-to-end Rules tests
remain roadmap work. Browser tests prove the synthetic flow only.
