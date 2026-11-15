# Decision log

Newest first. One line per decision, with the reason.

## 15 Nov 2026

- **`Purchase` is merged into `ItemPurchaseRecord`.** They described the same thing, so `calcStock` now takes the record's fields (`quantity`, `size`, `unit`, an optional `boughtAt` that defaults to today) plus the item's `name`, `category` and optional `lifeDays`, and rejects a quantity of 0. Import drafts use the same names (`quantity`, `boughtAt`), so the review can show the estimate before anything is saved.

- **`deleted` is on `Item`; `ItemPurchaseRecord` is one row per purchase; schemaVersion 1 and Dexie version 1 were changed in place.** Items carry `householdId` (prototype items get it from the migration context) but no longer createdAt or updatedAt, and the new `itemPurchaseRecords` table holds each purchase, ordered by `addedAt`. No real data existed yet, so neither version was bumped; from now on any change bumps them and adds a migration.

- **Domain tests live in `src/domain/testing/`, not beside each module; shared test data in `testing/helpers/`.** Keeps the rule modules and the tests apart. The three tests in `src/` that read files (design tokens, fixture usage, security headers) stay in `src/`, outside the domain's fences.

## 14 Nov 2026

- **Prototype migration: `basics` items go to `household`, keeping their group; the legacy `full` field is dropped.** Shelfie has no Household Basics category, and moving the items keeps their group names so nothing is lost. `full` (a full product name, sometimes with a brand link) has no place in the Item model.
- **Reorder share is any percentage from 1% to 100%, to 2 decimals.** Replaces the fixed 25/50/75/90% choices, so people can pick their own point. `validateItem` reports anything outside that as `invalid-share`; migrating prototype data rounds `pct` to 2 decimals. Not a `schemaVersion` bump: the stored shape is unchanged and every earlier value is still valid.
- **Migrations refuse newer versions and corrupt data.** `migrateToCurrent` throws `MigrationError` instead of guessing, so an old app can never damage data written by a newer one.

- **Import fallback shelf is Household Cleaning › Other.** The prototype put rows with an unknown shelf in Household Basics, which was removed; `FALLBACK_SHELF` in `src/domain/import-rows.ts`.
- **Renamed `legacy/` to `prototype/` (14 Nov 2026).** It is a living porting reference, not dead code; still local-only and gitignored.

- **Hosting: statichost.eu (Sweden).** EU-based static hosting that applies our `dist/_headers`, replacing the Cloudflare Pages / Netlify plan.
- **Supabase region: open.** Canada Central or an EU region; not chosen yet, so nothing may assume a region until it is.
- **iOS uses CocoaPods.** `@capacitor-mlkit/barcode-scanning` 8.x supports only CocoaPods on iOS, so add the platform with `npx cap add ios --packagemanager CocoaPods`.
- **Roadmap is 17 steps.** Steps 1-9 web app, 10 web barcode scanning, 11-17 iOS and Android, so the mobile work is planned in reviewable pieces.
- **Greener swaps use a bundled catalogue.** Keyed by product type, with a local `swapCache` for misses and Claude only on an explicit "Find another option", so Claude is called rarely and never sees anything about the user.
