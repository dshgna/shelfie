# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Shelfie is a private, local-first home inventory app (household and personal-care items). Web app first (installable PWA), then iOS and Android via Capacitor from the same code.

## Decisions (do not revisit without asking)

- React + TypeScript, built with Vite. Tailwind CSS v4 with the design tokens in `src/styles.css`. React Aria Components for accessible primitives. No Ionic UI.
- Data lives on the device first (IndexedDB). Optional sync from version 1 through Supabase, as **encrypted records only**.
- Encryption key is derived from a user passphrase on the device with Web Crypto. The server never sees the passphrase, the key or plaintext items. A printable recovery key is offered at setup.
- AI import (paste an order, upload screenshots) goes through a Supabase edge function. It is the one place plaintext leaves the device, so it must be an explicit per-use action, send only item lines, and keep no logs or content.
- Mobile: Capacitor wrapper, native barcode scanning, local notifications scheduled on the device.

## Privacy rules (hard rules)

1. The app may talk only to its own origin and Supabase. See `security-headers.ts`; keep its tests passing.
2. No third-party scripts, fonts, analytics, ad or crash SDKs, or remote images.
3. Encrypt item data on the device before any upload.
4. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` may reach the browser bundle. Never put a service-role key or any AI provider key in a `VITE_` variable or in the repo.
5. Never read, print or commit `.env` files. Use `.env.example` for documentation.
6. No real personal inventory in tests, fixtures, logs or screenshots. Use invented seed data.
7. Barcode lookups and any network call that reveals what a user owns must be opt-in.

## Commands

```sh
npm run setup        # first time only: installs packages and the test browser
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
- `src/storage/` (planned, step 3) IndexedDB behind a repository interface.
- `src/crypto/`, `src/sync/` (planned, step 5) encryption and Supabase sync.
- `src/ui/` (planned, step 4) React components. `src/styles.css` holds the tokens. `src/App.tsx` is currently a placeholder shell.
- `supabase/` (planned, steps 5-6) migrations and edge functions (including the AI proxy). `supabase/README.md` describes the intended tables and RLS.
- `legacy/prototype-v65.html` is the original single-file prototype. It is gitignored and exists only on the local machine: never commit it (it may contain personal data). It is the reference to port from, not code to ship. It is about 365 KB: grep for the function you need (e.g. `calcStock`, `needsRestock`, `migrate`) instead of reading it whole. Its in-app Claude chat calls the AI directly; that must not be ported as is (AI calls go through the edge function only).
- `docs/` architecture notes, data model, privacy policy draft (planned; see `docs/README.md`).

## How the pieces connect

- **Security headers are one source of truth.** `security-headers.ts` feeds `vite preview` (via `vite.config.ts`) and a build plugin that writes `dist/_headers` for Cloudflare Pages / Netlify. The dev server does not apply them, so CSP problems only show up in `npm run preview` and the e2e tests. The CSP is strict (`script-src 'self'`, `style-src 'self'`): no inline `<script>`/`<style>` in `index.html` and no `style="..."` in static HTML. `Permissions-Policy` allows the camera only (for barcode scanning). Allowing a new origin means changing `security-headers.ts` and `src/security-headers.test.ts` (which pins the exact `connect-src` list), and asking first (privacy rule 1).
- **E2E fails on any foreign request.** `e2e/foundation.spec.ts` records every request not to the app's origin and every console CSP violation. Playwright builds and previews on port 4173 (`strictPort`); locally it reuses an already running server, so restart a stale preview after changes.
- **Unit tests** only match `src/**/*.test.ts` in a `node` environment (no DOM, no `.tsx` tests) unless `vite.config.ts` is changed.
- **Theming.** Tokens are CSS variables in `src/styles.css`, exposed to Tailwind via `@theme inline` (`bg-surface`, `text-muted`, `border-line`, `text-cat-<category>`). Dark values appear twice (system dark and forced `data-theme="dark"`): edit both. Theme is switched by setting or removing `data-theme` on `<html>`. Fonts come from `@fontsource-variable/*` packages, never a CDN.
- **PWA.** `vite-plugin-pwa` in `vite.config.ts` holds the manifest and Workbox precache patterns (`js,css,html,svg,png,woff2`); new asset types must be added there to work offline.
- **TypeScript/ESLint.** `tsconfig.json` lists included paths explicitly; add new top-level TS files or folders there. `verbatimModuleSyntax` plus the `consistent-type-imports` rule means type-only imports must use `import type`. `noUncheckedIndexedAccess` is on. ESLint ignores `legacy/`.

## Conventions

- TypeScript strict. No `any`. Prefer small pure functions; keep UI thin.
- Every change to domain logic comes with tests. Estimation rules (units bought minus whole replacement periods elapsed) must stay covered.
- Items carry a `schemaVersion`; any model change adds a migration.
- Accessibility: keyboard operable, visible focus, 44px touch targets, works in light and dark, respects reduced motion.
- Keep user-facing copy plain and friendly; the mascot has moods (sleepy, party, worried, happy).

## Definition of done

Typecheck, lint, format check, unit tests and e2e tests pass; no new origins contacted; docs or this file updated if a decision changed.
