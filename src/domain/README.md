# src/domain

This folder holds Shelfie's pure rules: the item model, stock estimation, shelves, routine, import classification and greener swaps.

- Every module has a test file beside it: `x.ts` and `x.test.ts`.
- Nothing here may import React, Supabase, IndexedDB, Capacitor or anything from outside `src/domain`.
- Nothing here may use browser globals (`window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator`) or the network (`fetch`).
- Today's date is always passed in as a parameter, never read with `new Date()` inside a rule. The same goes for `Date.now()` and `Math.random()`. `new Date(someValue)` is fine: it converts a value without reading the clock.

How this is enforced:

- **ESLint** (`eslint.config.js`) blocks the imports, the browser globals (including `globalThis` and `self`, which reach them indirectly) and the clock and random calls above.
- **TypeScript** checks this folder a second time with `src/domain/tsconfig.json`, which has no browser (DOM) or Node types. Browser APIs are unknown names here, however they are reached. `npm run typecheck` runs both checks.
- **Tests** run in Node, where browser globals don't exist.
