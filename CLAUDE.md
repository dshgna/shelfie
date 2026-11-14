# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Shelfie is a private, local-first home inventory app (household and personal-care items). Web app first (installable PWA), then iOS and Android via Capacitor from the same code.

## Decisions (do not revisit without asking)

- React + TypeScript, built with Vite. Tailwind CSS v4 with the design tokens in `src/styles.css`. React Aria Components for accessible primitives. No Ionic UI.
- Data lives on the device first (IndexedDB). Optional sync from version 1 through Supabase, as **encrypted records only**.
- Encryption key is derived from a user passphrase on the device with Web Crypto. The server never sees the passphrase, the key or plaintext items. A printable recovery key is offered at setup.
- AI import (paste an order, upload screenshots) goes through a Supabase edge function. It is the one place plaintext leaves the device, so it must be an explicit per-use action, send only item lines, and keep no logs or content.
- Mobile: Capacitor 8 wrapper, native barcode scanning, local notifications scheduled on the device. iOS must use CocoaPods (not Swift Package Manager), because `@capacitor-mlkit/barcode-scanning` 8.x supports only CocoaPods on iOS: add the platform with `npx cap add ios --packagemanager CocoaPods`.
- Hosting: statichost.eu (Sweden), chosen 14 Nov 2026. It applies `dist/_headers` (see `security-headers.ts`) and builds from `statichost.yml`.
- Supabase stays the backend, for encrypted records only. **Open decision:** the project region is not chosen yet (Canada Central or an EU region). Ask before creating the project or writing anything that assumes a region.
- Roadmap is 17 steps (see `README.md`): 1-9 web app, 10 web barcode scanning, 11-17 iOS and Android.
- Greener swaps ("Shop now" suggests eco-friendly alternatives) come from a catalogue so Claude is called rarely:
  - A bundled static catalogue keyed by product type (the item's normalised "Shelf › Subcategory"). Each entry: `key`, `label`, `tags` (e.g. refillable, plastic-free, certified), `why`, shop search-URL templates, `source`, `reviewedAt`. It contains nothing about any user.
  - The user's choice is an optional `swap` field on the item (status `accepted` | `declined` | `snoozed`, swap key, decided date, optional snooze date). It is part of the item, so it is encrypted and synced with it (and needs a `schemaVersion` migration).
  - A local `swapCache` table holds results for product types the catalogue lacks. It is not user data: exclude it from export and sync.
  - Claude is called only on a catalogue miss, only after the user taps "Find another option", and only with the generic product type plus their tag choices (never brand, other items or order text), through the edge function. The reply is validated against the catalogue schema, only `https` link templates are accepted, and the result goes to `swapCache`.

## Privacy rules (hard rules)

1. The app may talk only to its own origin and Supabase. See `security-headers.ts`; keep its tests passing.
2. No third-party scripts, fonts, analytics, ad or crash SDKs, or remote images.
3. Encrypt item data on the device before any upload.
4. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` may reach the browser bundle. Never put a service-role key or any AI provider key in a `VITE_` variable or in the repo.
5. Never read, print or commit `.env` files. Use `.env.example` for documentation.
6. No real personal inventory in tests, fixtures, logs or screenshots. Use invented seed data.
7. Barcode lookups and any network call that reveals what a user owns must be opt-in.
8. The swap catalogue (bundled or cached) holds no user data and no affiliate links. Shop links are built from its URL templates, never taken from Claude-generated URLs.
9. `prototype/` is a read-only porting reference. Claude Code may read it to match behaviour, but must never edit it, copy personal data from it into the repo, or commit it. It must never be imported by app code, tests or build config.

## Commands

```sh
npm ci               # fresh checkout: installs the versions pinned in package-lock.json
npx playwright install chromium   # browser for the e2e tests
npm run dev          # local dev server
npm run typecheck
npm run lint
npm run format       # Prettier (format:check in CI)
npm test             # Vitest unit tests
npm run test:e2e     # builds, serves with production headers, runs Playwright
npm run build        # tsc --noEmit, then vite build (also emits dist/_headers)
npm run preview      # serves dist on :4173 with the production security headers
```

Single tests:

```sh
npx vitest run src/security-headers.test.ts        # one file
npx vitest run -t "only allows our own origin"     # by test name
npx playwright test e2e/foundation.spec.ts --project=desktop   # projects: desktop, phone (Pixel 7)
npx playwright test -g "theme button"
```

Versions are now resolved in `package.json` and `package-lock.json`. Use `npm ci` (or `npm install`) on a fresh checkout. Do not re-run `npm run setup`: it reinstalls every package at `latest` and bumps all the pins. Node 22+ (`.nvmrc`). CI (`.github/workflows/ci.yml`) runs lint, format:check, typecheck, unit, e2e, then `npm audit --omit=dev --audit-level=high`.

## Layout

Roadmap steps are in `README.md`. Folders marked (planned) do not exist yet; create them in the step shown.

- `src/domain/` (planned, step 2) pure TypeScript: item model, stock estimation, shelves, routine, import classification. No React, no storage, no network. Fully unit tested.
- `src/domain/swaps/` (planned) greener-swap catalogue, lookup and reply validation. Pure TypeScript like the rest of `src/domain/`.
- `src/storage/` (planned, step 3) IndexedDB behind a repository interface. The `swapCache` table lives here too (excluded from export and sync).
- `src/crypto/`, `src/sync/` (planned, step 5) encryption and Supabase sync.
- `src/ui/` (planned, step 4) React components. `src/styles.css` holds the tokens. `src/App.tsx` is currently a placeholder shell.
- `supabase/` (planned, steps 5-6) migrations and edge functions (including the AI proxy). `supabase/README.md` describes the intended tables and RLS.
- `prototype/` holds the original single-file prototype (`prototype-v65.html`, plus dated downloads named `prototype-live-YYYY-MM-DD.html`; use the newest). It is gitignored and exists only on the local machine: never commit it (it may contain personal data). See hard rule 9. It is a frozen snapshot: once a screen is ported, the source of truth for tokens and copy is the design system doc in the owner's claude.ai Project (`shelfie/06-design-system.md`, not in this repo), not the prototype. If you need the current tokens or copy rules and this repo doesn't have them, ask the owner rather than guessing values. `design/tokens.json` (planned, not created yet) will mirror the tokens JSON from the design system doc. Once it exists, `src/styles.css` must match it and a Vitest check enforces that. It is the reference to port from, not code to ship. It is about 365 KB: grep for the function you need (e.g. `calcStock`, `needsRestock`, `migrate`) instead of reading it whole. Its in-app Claude chat calls the AI directly; that must not be ported as is (AI calls go through the edge function only).
- `docs/` `decisions.md` (dated decision log; add a line when a decision changes), plus planned architecture notes, data model and privacy policy draft (see `docs/README.md`). `docs/design/` (create when needed) holds exported PNG/PDF screens from the design canvas. Never put them in `prototype/`.

## How the pieces connect

- **Security headers are one source of truth.** `security-headers.ts` feeds `vite preview` (via `vite.config.ts`) and a build plugin that writes `dist/_headers` for statichost.eu (a `*` path line, headers indented four spaces). The dev server does not apply them, so CSP problems only show up in `npm run preview` and the e2e tests. The CSP is strict (`script-src 'self'`; `style-src 'self'` plus one pinned hash for React Aria's injected `#react-aria-pressable-style`): no inline `<script>`/`<style>` in `index.html` and no `style="..."` in static HTML. A React Aria upgrade that changes that style fails the e2e CSP test with the new hash; update the hash in `security-headers.ts` and its pinned test. `Permissions-Policy` allows the camera only (for barcode scanning). Allowing a new origin means changing `security-headers.ts` and `src/security-headers.test.ts` (which pins the exact `connect-src` and `style-src` lists), and asking first (privacy rule 1).
- **E2E fails on any foreign request.** `e2e/foundation.spec.ts` records every request not to the app's origin and every console CSP violation. Playwright builds and previews on port 4173 (`strictPort`); locally it reuses an already running server, so restart a stale preview after changes.
- **Unit tests** only match `src/**/*.test.ts` in a `node` environment (no DOM, no `.tsx` tests) unless `vite.config.ts` is changed.
- **Theming.** Tokens are CSS variables in `src/styles.css`, exposed to Tailwind via `@theme inline` (`bg-surface`, `text-muted`, `border-line`, `text-cat-<category>`). Dark values appear twice (system dark and forced `data-theme="dark"`): edit both. Theme is switched by setting or removing `data-theme` on `<html>`. Fonts come from `@fontsource-variable/*` packages, never a CDN.
- **PWA.** `vite-plugin-pwa` in `vite.config.ts` holds the manifest and Workbox precache patterns (`js,css,html,svg,png,woff2`); new asset types must be added there to work offline.
- **TypeScript/ESLint.** `tsconfig.json` lists included paths explicitly; add new top-level TS files or folders there. `verbatimModuleSyntax` plus the `consistent-type-imports` rule means type-only imports must use `import type`. `noUncheckedIndexedAccess` is on. ESLint and Prettier ignore `prototype/`.

## Conventions

- TypeScript strict. No `any`. Prefer small pure functions; keep UI thin.
- Every change to domain logic comes with tests. Estimation rules (units bought minus whole replacement periods elapsed) must stay covered.
- Items carry a `schemaVersion`; any model change adds a migration.
- Accessibility: keyboard operable, visible focus, 44px touch targets, works in light and dark, respects reduced motion.
- Keep user-facing copy plain and friendly; the mascot has moods (sleepy, party, worried, happy).

## Definition of done

Typecheck, lint, format check, unit tests and e2e tests pass; no new origins contacted; docs or this file updated if a decision changed.
