# Decision log

Newest first. One line per decision, with the reason.

## 14 Nov 2026

- **Renamed `legacy/` to `prototype/` (14 Nov 2026).** It is a living porting reference, not dead code; still local-only and gitignored.

- **Hosting: statichost.eu (Sweden).** EU-based static hosting that applies our `dist/_headers`, replacing the Cloudflare Pages / Netlify plan.
- **Supabase region: open.** Canada Central or an EU region; not chosen yet, so nothing may assume a region until it is.
- **iOS uses CocoaPods.** `@capacitor-mlkit/barcode-scanning` 8.x supports only CocoaPods on iOS, so add the platform with `npx cap add ios --packagemanager CocoaPods`.
- **Roadmap is 17 steps.** Steps 1-9 web app, 10 web barcode scanning, 11-17 iOS and Android, so the mobile work is planned in reviewable pieces.
- **Greener swaps use a bundled catalogue.** Keyed by product type, with a local `swapCache` for misses and Claude only on an explicit "Find another option", so Claude is called rarely and never sees anything about the user.
