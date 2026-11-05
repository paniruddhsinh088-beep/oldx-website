# OLDX isolated mobile demonstration

Entry: `/mobile-demo.html` (default Gujarati; Hindi/English selector).
Products → details → sample Store; Providers → multi-service profile → local Chat;
Admin hide/restore/reset; local photo selection/remove and draft rehearsal. All records
are synthetic. Illustrations are not seller photos. Chat/changes/drafts stay in memory
and reset on reload. Do not enter personal information. No real Admin authorization,
upload, publication, moderation, Auth or database connection is provided by this demo.

## Open on an Android phone without deployment

On your own computer, check out `security-hardening-review` and install the existing
Node toolchain. From the repository run:

```sh
npm run preview:mobile -- --lan
```

Connect computer and Android phone to the same trusted Wi-Fi. In Android Chrome open:
`http://<computer-private-LAN-IP>:8080/mobile-demo.html`.
Replace the placeholder with that computer's private Wi-Fi IP. Keep the terminal open;
Ctrl+C stops the server. Local firewall may require allowing port 8080 on the private
network only. Do not forward the port to the Internet. Without `--lan`, the server
listens only on `127.0.0.1`, for desktop preview at `http://127.0.0.1:8080/`.
The phone cannot open the cloud execution environment's localhost directly.

No hosted URL was created by this local server. A hosted Preview requires the applicable
approved deployment workflow; do not manually deploy or activate backend flags to view
this demonstration. Existing Git-triggered Preview automation is separate from this
local command. Capacitor packaging is not started; the demo uses relative assets,
hash navigation and standard browser APIs. Android-sized Chromium tests are not a
physical Android-device acceptance test. Production and real staging remain HOLD/NO-GO.
