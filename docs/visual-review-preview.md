# OLDX synthetic visual review

Issue #13. Source-only preparation. Production remains HOLD / NO-GO.

## Build and inspect locally

From the review repository, run `node scripts/build-visual-review.mjs HEAD` or supply a full reviewed commit SHA. The command prints the new `visual-review/<sha>-<suffix>` directory. It reads each input from the selected Git commit, so workspace files and local Firebase configuration never enter the output. The banner shows the exact source SHA and UTC build date.

For local visual inspection, serve the printed directory on loopback only. With Python installed, run `python -m http.server 8080 --bind 127.0.0.1 --directory "<printed directory>"` and open `http://127.0.0.1:8080/` in the same environment. The HTML enforces its CSP locally. The browser regression also serves the artifact with the Pages header rules.

The homepage keeps the existing synthetic Product, Store, Provider and Chat journeys. Its **Product & Store visual review** link opens `/listings.html`, which uses the real Product Card, detail/gallery and Storefront/Catalogue renderers from `index.html`. It includes a valid sample image, a failed-image fallback and long seller text. Use the catalogue fixture selector to inspect loaded, loading, empty and error states, then retry or filter by category. Data and interactions stay in memory.

The listing page copies the authored homepage CSS and uses local equivalents for the extracted Tailwind layout utilities. Fonts, icons, and some utility styling differ from the real website. The visual review omits live maps, contact actions, accounts, admin and uploads. The regular synthetic demo still offers in-memory Chat.

The synthetic Services route remains the mobile-demo view. The real Service page entry imports website Auth session ports, private photo controls and media transports. Batch C verifies the real UI with isolated browser fixtures and leaves those modules outside the hosted-review artifact. Real Service visual parity would require extracting a read-only renderer and reviewing its dependency boundary.

Run `node --test tests/service/mobile-demo-safety.test.mjs` and `node --test tests/browser/mobile-demo.test.mjs`. Set `CHROMIUM_PATH` to a local Chrome or Chromium executable when needed.

## Future Cloudflare Pages handoff

Proceed only after Yasmin separately authorizes the preview publication and any required Access change. Issue #13 records that the existing Pages project is `oldx-website`, its production branch is `security-hardening-review`, automatic deployments are disabled, and preview Access is disabled. Treat these as recorded values and verify them in the dashboard before publishing.

1. Confirm the project, its production deployment ID and both disabled automatic-deployment controls. Keep the existing production URL and custom domains in place. Use the nonproduction branch alias `visual-review` only. Abort if it is the production branch or is already in use for unrelated work. No Git branch or Git integration change is needed for this manual upload.
2. Verify that Pages preview Access covers the branch alias and the unique deployment hostname, including static assets. Restrict membership to named reviewers and verify that the browser used for review can authenticate. The project-wide Pages preview Access toggle can affect other previews. Obtain specific approval before changing it. Preview URLs are public by default and noindex only controls indexing. Cloudflare offers a Zero Trust Free plan, but its documented onboarding can require payment details even for Free. If this account lacks eligible existing protection, stop before onboarding or publishing. [Pages preview access](https://developers.cloudflare.com/pages/configuration/preview-deployments/#customize-preview-deployments-access) · [Zero Trust onboarding](https://developers.cloudflare.com/cloudflare-one/setup/)
3. Build from the approved SHA and run the focused Node and browser checks. Verify the output directory has only the generated HTML, headers, robots file and allowlisted static assets. Run Wrangler from **inside the printed artifact directory**, so repository-level `functions/` and configuration cannot be picked up. Use an existing authenticated, owner-approved Wrangler session. A Git-integrated Pages project supports manual Wrangler deployment while automatic deployments stay disabled. [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Wrangler preview upload](https://developers.cloudflare.com/pages/get-started/direct-upload/#deploy-your-assets)

   ```powershell
   Push-Location -LiteralPath '<printed artifact directory>'
   try {
       wrangler pages deploy . --project-name oldx-website --branch visual-review
   } finally {
       Pop-Location
   }
   ```

4. Record the preview deployment ID and both URLs. In a signed-out browser, check the alias and unique URL plus an asset URL. Each should require Access or deny the request. In an authorized browser, verify the SHA banner, CSP/noindex headers, the five synthetic journeys and that missing paths including `/api/` and `/firebase-env.js` serve no application data. Confirm that the recorded production deployment ID and automatic deployment controls still match.
5. If checks fail, stop sharing the URL and keep preview access denied. With separate approval, replace the `visual-review` alias with a known-safe preview and remove the failed preview deployment after it is no longer the latest on that branch. Verify both preview hostnames again. The production deployment is outside this rollback. [Preview cleanup](https://developers.cloudflare.com/pages/configuration/preview-deployments/#delete-preview-deployments)
