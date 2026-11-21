# Shelfie

A private home inventory. It remembers what's on your shelves, tells you what's running low, and helps you restock without the guesswork.

**Status:** pre-launch. Web app planned for 4 January 2027, iPhone and Android for 10 January 2027. Join the waitlist at [homeshelfie.com](https://homeshelfie.com).

## What it does

Working in the web app today: shelves and item rows, an item editor, a shopping list, a skincare routine view, and the Fill my shelves screens (with a mock AI result until the AI import is built).

Planned: end-to-end encrypted sync, AI import from pasted orders and screenshots, a greener swaps catalogue, barcode scanning, and iOS and Android apps.

## Privacy

- Your items live on your device first. Sync is optional and encrypted on the device, so the server never sees your passphrase, your key or your items.
- AI import is the one place plaintext leaves the device. It only runs when you ask, sends only the item lines, and keeps no logs.
- The app talks only to its own site and Supabase. No third-party scripts, fonts or analytics.

## Self-hosting

Deferred until after launch. The code is AGPL-3.0, so you may run your own copy, but there is no guide or support yet.

## Develop

Needs Node 22 or newer.

```sh
npm ci
npx playwright install chromium
npm run dev            # http://localhost:5173
npm run lint && npm run typecheck && npm test
npm run test:e2e
```

More in [CLAUDE.md](CLAUDE.md), [docs/development.md](docs/development.md) and [docs/roadmap.md](docs/roadmap.md).

## Licence

[AGPL-3.0](LICENSE).
