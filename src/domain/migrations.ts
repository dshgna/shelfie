// Upgrades stored or imported items to the current Item shape, one small step per version.
// Ported from the prototype's migrate and the helpers it calls (remap, stepFor, relabel,
// titleCase, tenPct). Only shapes and field defaults live here: reading and writing storage is
// step 3.
//
// Version mapping
// ---------------
// The prototype stamps each item with `v` (1 to 6). Shelfie stamps `schemaVersion` (1, 2, ...).
// Both sit on one ladder, oldest first:
//
//   prototype v1 → v2 → v3 → v4 → v5 → v6 → schemaVersion 1 → (schemaVersion 2, when it exists)
//
// - An item with no `v` and no `schemaVersion` is prototype v1, as in the prototype
//   (its `it.v >= 2` is false for a missing v).
// - schemaVersion 1 is Shelfie's first shape: the prototype's v6 with fields renamed
//   (cat → category, qty → quantity, min + pct → reorder, link or else blink → link, and so on).
// - The version is per item, not per collection, as in the prototype: one collection can mix
//   versions, and each item climbs the ladder from its own rung.
//
// Behaviour matches the prototype, except:
// - newer versions are refused with a MigrationError (the prototype silently left them alone);
// - corrupt data throws a MigrationError (the prototype skipped it, or replaced it with the
//   example items);
// - the prototype's 'basics' category becomes 'household', keeping its group (owner's decision,
//   14 Nov 2026), and the legacy `full` field is dropped.

import { InvalidDateError, isValidIsoDate, isValidIsoDateTime, type IsoDateTime } from './dates'
import {
  CATEGORIES,
  CURRENT_SCHEMA_VERSION,
  type Category,
  type IsoDate,
  type Item,
  type ReorderRule,
  type ReorderShare,
} from './item'
import { guessDays } from './typical'
import { normalizeItem, validateItem, type ValidationIssue } from './validate'

// ---------------------------------------------------------------------------------------------
// Versions, errors and results
// ---------------------------------------------------------------------------------------------

/** Every version on the ladder, oldest first. Add the new version here when the Item shape changes. */
export const VERSIONS = [
  'prototype-v1',
  'prototype-v2',
  'prototype-v3',
  'prototype-v4',
  'prototype-v5',
  'prototype-v6',
  'schema-1',
] as const

export type StoredVersion = (typeof VERSIONS)[number]

/** The rung every migration ends on. */
export const CURRENT_VERSION = `schema-${CURRENT_SCHEMA_VERSION}` as const satisfies StoredVersion

/** The newest `v` the prototype ever wrote. */
const LAST_PROTOTYPE_V = 6

export type MigrationErrorCode =
  /** The data as a whole is not a list of items or a prototype map of items. */
  | 'not-a-collection'
  /** One entry is not an object. */
  | 'not-an-item'
  /** The version is unreadable (not a whole number, below 1, or both `v` and `schemaVersion`). */
  | 'unknown-version'
  /** Written by a newer app. Refused so an old app can never damage newer data. */
  | 'newer-version'
  /** A field is missing, has the wrong type or holds a value no version allows. */
  | 'bad-field'
  /** Two items share an id. */
  | 'duplicate-id'

/** Thrown when data can't be migrated safely. Nothing is guessed and nothing is dropped. */
export class MigrationError extends Error {
  readonly code: MigrationErrorCode
  /** Where the bad item is: its key in a prototype map, or its position ("0", "1"...) in a list. */
  readonly itemKey?: string
  /** The stored field name the problem is about, when there is one. */
  readonly field?: string

  constructor(
    code: MigrationErrorCode,
    message: string,
    details: { itemKey?: string; field?: string } = {},
  ) {
    super(message)
    this.name = 'MigrationError'
    this.code = code
    if (details.itemKey !== undefined) this.itemKey = details.itemKey
    if (details.field !== undefined) this.field = details.field
  }
}

/** What the caller supplies. Today is a parameter, as everywhere in src/domain. */
export interface MigrationContext {
  /** Used where the prototype filled in today's date (a start date for prototype v4). */
  today: IsoDate
  /** The household that prototype items are given, since the prototype has no households. */
  householdId: string
  /** The updatedAt that prototype items are given, since the prototype keeps no timestamps. */
  now: IsoDateTime
}

/** One item that made it to the current version. */
export interface MigratedItem {
  /** The item at CURRENT_SCHEMA_VERSION, after normalizeItem. */
  item: Item
  /** What validateItem found on it. Empty means valid. The item is still returned, never dropped. */
  issues: ValidationIssue[]
  /** The version it was stored at, so callers can tell what was upgraded. */
  from: StoredVersion
}

/** An item a migration deletes on purpose (the prototype removed some example items). */
export interface RemovedEntry {
  /** Its key in a prototype map, or its position in a list. */
  key: string
  from: StoredVersion
  reason: string
}

export interface MigrationResult {
  /** Every surviving item, in input order. */
  items: MigratedItem[]
  /** Items removed on purpose by a migration step. Listed so nothing disappears silently. */
  removed: RemovedEntry[]
}

/** What a step returns instead of an item when the prototype's migration deleted that item. */
export class RemovedItem {
  readonly reason: string
  constructor(reason: string) {
    this.reason = reason
  }
}

/**
 * One rung of the ladder. `migrate` takes the item from storage as `unknown`, because stored
 * or imported data can't be trusted, and returns the item one version newer (or a RemovedItem).
 * It never changes its input: it builds a new object.
 */
export interface MigrationStep {
  readonly from: StoredVersion
  readonly to: StoredVersion
  /** What changes, in plain words. */
  readonly summary: string
  readonly migrate: (item: unknown, context: MigrationContext) => unknown
}

// ---------------------------------------------------------------------------------------------
// Small type guards
// ---------------------------------------------------------------------------------------------

type Fields = Readonly<Record<string, unknown>>

/** A plain object with fields: not null, not an array. */
function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asFields(value: unknown): Fields {
  if (!isFields(value)) {
    throw new MigrationError('not-an-item', 'This entry is not an item (an object with fields).')
  }
  return value
}

/** The text, or `fallback` for anything else. For the prototype steps, which read loosely like the prototype. */
function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0
}

function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((category) => category === value)
}

function isStoredVersion(value: string): value is StoredVersion {
  return VERSIONS.some((version) => version === value)
}

/** Missing means absent, undefined or null (JSON has no undefined, so a cleared field may be null). */
function isMissing(value: unknown): boolean {
  return value === undefined || value === null
}

function badField(field: string, expected: string): MigrationError {
  return new MigrationError('bad-field', `The field "${field}" must be ${expected}.`, { field })
}

// Strict readers for the last prototype step and for current items.

function requiredText(fields: Fields, field: string): string {
  const value = fields[field]
  if (typeof value !== 'string') throw badField(field, 'text')
  return value
}

function optionalText(fields: Fields, field: string, fallback: string): string {
  const value = fields[field]
  if (isMissing(value)) return fallback
  if (typeof value !== 'string') throw badField(field, 'text')
  return value
}

/** Text, or undefined when missing or ''. The prototype stores '' for "not set". */
function nonEmptyText(fields: Fields, field: string): string | undefined {
  const value = optionalText(fields, field, '')
  return value === '' ? undefined : value
}

function requiredNumber(fields: Fields, field: string): number {
  const value = fields[field]
  if (typeof value !== 'number') throw badField(field, 'a number')
  return value
}

function optionalNumber(fields: Fields, field: string): number | undefined {
  const value = fields[field]
  if (isMissing(value)) return undefined
  if (typeof value !== 'number') throw badField(field, 'a number')
  return value
}

function optionalBoolean(fields: Fields, field: string, fallback: boolean): boolean {
  const value = fields[field]
  if (isMissing(value)) return fallback
  if (typeof value !== 'boolean') throw badField(field, 'true or false')
  return value
}

// ---------------------------------------------------------------------------------------------
// Prototype helpers, ported as they are
// ---------------------------------------------------------------------------------------------

/** The skincare routine's groups. Prototype `STEP_SUBS`. */
const STEP_GROUPS = [
  'Step 1 · Oil Cleanser',
  'Step 2 · Water Cleanser',
  'Step 3 · Toner',
  'Step 4 · Essence',
  'Step 5 · Serum or Ampoule',
  'Step 6 · Moisturiser',
  'Step 7 · Sun Protection',
] as const

/** Which routine step an old "Skincare" item belongs to, from its name. Prototype `stepFor`. */
function stepFor(name: string): string {
  const n = name.toLowerCase()
  if (/oil|balm/.test(n) && /clean|balm/.test(n)) return STEP_GROUPS[0]
  if (/clean|foam/.test(n)) return STEP_GROUPS[1]
  if (/toner/.test(n)) return STEP_GROUPS[2]
  if (/essence/.test(n)) return STEP_GROUPS[3]
  if (/serum|ampoule/.test(n)) return STEP_GROUPS[4]
  if (/moistur|day cream|gel cream/.test(n)) return STEP_GROUPS[5]
  if (/spf|sun/.test(n)) return STEP_GROUPS[6]
  return 'Eye Cream'
}

interface Placement {
  cat: string
  sub: string
}

/**
 * Where a prototype v1 item goes in the ten v2 categories, or undefined if its category was
 * already one of them. Version 1 had three: cleaning, beauty, essentials. Prototype `remap`.
 */
function remap(item: Fields): Placement | undefined {
  const n = textOr(item.name, '').toLowerCase()
  const s = textOr(item.sub, '')
  switch (item.cat) {
    case 'cleaning':
      if (s === 'Kitchen') {
        return { cat: 'kitchen', sub: /dish|washing/.test(n) ? 'Dishwashing' : 'Oven & Surfaces' }
      }
      if (s === 'Bathroom') return { cat: 'bathroom', sub: 'Cleaning' }
      if (s === 'Laundry') {
        return {
          cat: 'laundry',
          sub: /stain|softener|conditioner/.test(n) ? 'Stain & Fabric Care' : 'Washing',
        }
      }
      return { cat: 'household', sub: 'Floors, Surfaces & Cloths' }
    case 'beauty':
      if (s === 'Skincare') return { cat: 'skincare', sub: stepFor(n) }
      if (STEP_GROUPS.some((step) => step === s) || s === 'Eye Cream' || s === 'Skincare extras') {
        return { cat: 'skincare', sub: s }
      }
      if (/shampoo/.test(n)) return { cat: 'hair', sub: 'Shampoo' }
      if (/conditioner/.test(n)) return { cat: 'hair', sub: 'Conditioner' }
      if (/hand (soap|wash)/.test(n)) return { cat: 'hair', sub: 'Hand Soap' }
      if (/body wash|shower|soap|bath/.test(n)) return { cat: 'hair', sub: 'Body Soap' }
      return { cat: 'beauty', sub: s || 'Body Creams' }
    case 'essentials':
      if (s === 'Paper Goods') {
        if (/toilet/.test(n)) return { cat: 'bathroom', sub: 'Toilet Paper' }
        if (/kitchen/.test(n)) return { cat: 'kitchen', sub: 'Waste & Paper' }
        return { cat: 'basics', sub: 'Paper Goods' }
      }
      if (s === 'Health & first aid') {
        return {
          cat: 'health',
          sub: /pain|medic|tablet|relief/.test(n) ? 'Medicines' : 'First Aid',
        }
      }
      if (s === 'Dental & personal') {
        return /cotton/.test(n)
          ? { cat: 'beauty', sub: 'Tools & Accessories' }
          : { cat: 'dental', sub: 'Dental Care' }
      }
      if (/bag/.test(n)) return { cat: 'kitchen', sub: 'Waste & Paper' }
      return { cat: 'basics', sub: /batter|bulb/.test(n) ? 'Batteries & Bulbs' : 'Other Basics' }
    default:
      return undefined
  }
}

const SMALL_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'or',
  'of',
  'the',
  'in',
  'to',
  'for',
  'on',
])

/**
 * Capitalises each word's first letter, except small words after the first ("Waste and Paper").
 * Oddity kept: the rest of each word is left as it is, so "DISH soap" becomes "DISH Soap".
 * Prototype `titleCase`.
 */
function titleCase(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z']*/g, (word: string, offset: number) => {
    const lower = word.toLowerCase()
    return offset > 0 && SMALL_WORDS.has(lower)
      ? lower
      : word.charAt(0).toUpperCase() + word.slice(1)
  })
}

/**
 * Version 3's group names: Body & Bath groups by product, Beauty "Bodycare" becomes "Body Creams",
 * and every group name in Title Case. Prototype `relabel`.
 */
function relabel(item: Fields): string {
  const n = textOr(item.name, '').toLowerCase()
  let group = textOr(item.sub, '')
  if (item.cat === 'hair') {
    if (/shampoo/.test(n)) group = 'Shampoo'
    else if (/conditioner/.test(n)) group = 'Conditioner'
    else if (/hand/.test(n)) group = 'Hand Soap'
    else if (!group || group === 'Hair' || group === 'Bath & shower') group = 'Body Soap'
  } else if (item.cat === 'beauty' && group === 'Bodycare') {
    group = 'Body Creams'
  }
  return titleCase(group)
}

/** Units that reorder at 10% left from prototype v4 on. Prototype `TEN`. */
const TEN_PERCENT_UNITS: ReadonlySet<unknown> = new Set(['bottle', 'tube', 'bar'])

/**
 * A category for guessDays. Its category only decides the bottle guess (90 days in home
 * categories, 60 otherwise). 'basics' was a home category in the prototype, so it counts as
 * 'household'. Any other unknown value gets a non-home category, which gives the prototype's
 * answer for it; the last step refuses unknown categories anyway.
 */
function categoryForGuess(cat: unknown): Category {
  if (cat === 'basics') return 'household'
  return isCategory(cat) ? cat : 'beauty'
}

/**
 * Version 4: bottles, tubes and bars reorder when the one in use is 10% left. That needs a
 * lifetime, so a typical one is guessed where there is none, and a start date (today) where there
 * is something in stock but no start. Returns the fields to change, or undefined for other units.
 * Prototype `tenPct`.
 */
function tenPercentFields(item: Fields, today: IsoDate): Fields | undefined {
  if (!TEN_PERCENT_UNITS.has(item.unit)) return undefined
  const life = isPositiveNumber(item.life)
    ? item.life
    : guessDays(
        textOr(item.name, ''),
        textOr(item.size, ''),
        textOr(item.unit, ''),
        categoryForGuess(item.cat),
      )
  const inStock = isPositiveNumber(item.qty)
  // `item.start || today`: any start already there is kept (the last step checks its type).
  return { min: 0, pct: 0.9, life, start: inStock ? item.start || today : '' }
}

// ---------------------------------------------------------------------------------------------
// The last prototype step: v6 to Shelfie's first shape
// ---------------------------------------------------------------------------------------------

/** 'basics' is gone in Shelfie; its items move to 'household' and keep their group. */
function categoryFrom(cat: string): Category {
  if (cat === 'basics') return 'household'
  if (isCategory(cat)) return cat
  throw badField('cat', `one of ${CATEGORIES.join(', ')} (or basics), not "${cat}"`)
}

/**
 * The prototype's `min` and `pct` as one rule. Its pctMode is `life > 0 && min === 0`, and its
 * timing uses `pct > 0 ? pct : 0.5`, so:
 * - min other than 0: reorder when the count is at or below min;
 * - min 0 with a lifetime: reorder at that share, rounded to 2 decimals (0.5 when pct is missing
 *   or 0 or less). A share above 1 is kept for validateItem to report as 'invalid-share';
 * - min 0 without a lifetime: reorder when none are left.
 */
function reorderFrom(min: number, lifeDays: number | undefined, pct: unknown): ReorderRule {
  if (min !== 0) return { kind: 'count', atOrBelow: min }
  if (lifeDays === undefined) return { kind: 'count', atOrBelow: 0 }
  if (isMissing(pct) || (typeof pct === 'number' && pct <= 0)) return { kind: 'share', share: 0.5 }
  if (typeof pct !== 'number') throw badField('pct', 'a number')
  return { kind: 'share', share: roundShare(pct) }
}

/** To 2 decimals: Shelfie stores shares as whole percentages or hundredths (0.333 → 0.33). */
function roundShare(share: number): ReorderShare {
  return Math.round(share * 100) / 100
}

/** Shelfie keeps one link: the prototype's product link (`link`), or else its brand link (`blink`). */
function linkFrom(item: Fields): string | undefined {
  return nonEmptyText(item, 'link') ?? nonEmptyText(item, 'blink')
}

/**
 * Renames prototype v6 fields to Shelfie's and fills in what old items may lack.
 * Required (every prototype version wrote them): id, name, cat, qty, unit, min, par.
 * householdId and updatedAt come from the context. Defaults for fields added later or left
 * empty: brand, loc, size, note → ''; sub → 'Other'; unit '' → 'unit' (both as the prototype's
 * form does); example → false; deleted → false (the prototype erases removed items); life 0 or
 * missing, start, expiry, link and blink '' or missing → left out. `v`, `full` and unknown fields are dropped.
 */
function prototypeToSchema1(input: unknown, context: MigrationContext): unknown {
  const item = asFields(input)
  const id = requiredText(item, 'id')
  if (id === '') throw badField('id', 'non-empty text')
  const life = optionalNumber(item, 'life')
  const lifeDays = life !== undefined && life > 0 ? life : undefined

  const next: Item = {
    schemaVersion: 1,
    id,
    householdId: context.householdId,
    updatedAt: context.now,
    name: requiredText(item, 'name'),
    brand: optionalText(item, 'brand', ''),
    category: categoryFrom(requiredText(item, 'cat')),
    group: optionalText(item, 'sub', '') || 'Other',
    location: optionalText(item, 'loc', ''),
    quantity: requiredNumber(item, 'qty'),
    unit: requiredText(item, 'unit') || 'unit',
    size: optionalText(item, 'size', ''),
    reorder: reorderFrom(requiredNumber(item, 'min'), lifeDays, item.pct),
    buyUpTo: requiredNumber(item, 'par'),
    notes: optionalText(item, 'note', ''),
    isExample: optionalBoolean(item, 'example', false),
    deleted: false,
  }
  const link = linkFrom(item)
  if (link !== undefined) next.link = link
  const startedOn = nonEmptyText(item, 'start')
  const expiresOn = nonEmptyText(item, 'expiry')
  if (lifeDays !== undefined) next.lifeDays = lifeDays
  if (startedOn !== undefined) next.startedOn = startedOn
  if (expiresOn !== undefined) next.expiresOn = expiresOn
  return next
}

// ---------------------------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------------------------

/** Ordered, oldest first. Each step's `to` is the next step's `from` (a test checks this). */
export const MIGRATIONS: readonly MigrationStep[] = [
  {
    from: 'prototype-v1',
    to: 'prototype-v2',
    summary:
      'Moves items from the three old categories (cleaning, beauty, essentials) into the ten new ones.',
    migrate: (input) => {
      const item = asFields(input)
      return { ...item, ...remap(item), v: 2 }
    },
  },
  {
    from: 'prototype-v2',
    to: 'prototype-v3',
    summary: 'Renames groups: Body & Bath by product, Bodycare to Body Creams, all in Title Case.',
    migrate: (input) => {
      const item = asFields(input)
      return { ...item, sub: relabel(item), v: 3 }
    },
  },
  {
    from: 'prototype-v3',
    to: 'prototype-v4',
    summary:
      'Bottles, tubes and bars reorder at 10% left, with a lifetime and start date filled in.',
    migrate: (input, { today }) => {
      const item = asFields(input)
      return { ...item, ...tenPercentFields(item, today), v: 4 }
    },
  },
  {
    from: 'prototype-v4',
    to: 'prototype-v5',
    summary: 'No change to the item: the prototype has no code for version 5.',
    migrate: (input) => ({ ...asFields(input), v: 5 }),
  },
  {
    from: 'prototype-v5',
    to: 'prototype-v6',
    summary:
      'Removes the old example sheet masks, fills in brand, and gives bottles, tubes and bars ' +
      'still without a lifetime the 10% rule.',
    migrate: (input, { today }) => {
      const item = asFields(input)
      if (
        item.example &&
        item.sub === 'Sleeping Mask' &&
        /sheet mask/i.test(textOr(item.name, ''))
      ) {
        return new RemovedItem('An example sheet mask the prototype removed in version 6.')
      }
      const tenPercent = isPositiveNumber(item.life) ? undefined : tenPercentFields(item, today)
      return { ...item, brand: item.brand || '', ...tenPercent, v: 6 }
    },
  },
  {
    from: 'prototype-v6',
    to: 'schema-1',
    summary: "Renames the prototype's fields to Shelfie's and fills in defaults for missing ones.",
    migrate: prototypeToSchema1,
  },
]

/**
 * Which version an item is stored at.
 * @throws MigrationError 'newer-version' for versions this app doesn't know yet,
 *   'unknown-version' for versions that can't be read, 'not-an-item' for non-objects.
 */
export function versionOf(input: unknown): StoredVersion {
  const item = asFields(input)
  const schema = item.schemaVersion
  const v = item.v
  if (schema !== undefined && v !== undefined) {
    throw new MigrationError(
      'unknown-version',
      'This item has both a prototype and a Shelfie version.',
    )
  }
  if (schema !== undefined)
    return checkedVersion(schema, CURRENT_SCHEMA_VERSION, (n) => `schema-${n}`)
  if (v !== undefined) return checkedVersion(v, LAST_PROTOTYPE_V, (n) => `prototype-v${n}`)
  return 'prototype-v1'
}

function checkedVersion(
  value: unknown,
  newest: number,
  label: (n: number) => string,
): StoredVersion {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new MigrationError('unknown-version', `The version ${String(value)} can't be read.`)
  }
  if (value > newest) {
    throw new MigrationError(
      'newer-version',
      `This item was saved by a newer version of Shelfie (version ${value}). Update the app to open it.`,
    )
  }
  const version = label(value)
  if (!isStoredVersion(version)) {
    throw new MigrationError('unknown-version', `There is no migration for version ${value}.`)
  }
  return version
}

/** Runs the steps from `from` up to CURRENT_VERSION. */
function climb(item: unknown, from: StoredVersion, context: MigrationContext): unknown {
  if (from === CURRENT_VERSION) return item
  const start = MIGRATIONS.findIndex((step) => step.from === from)
  if (start < 0) throw new MigrationError('unknown-version', `There is no migration from ${from}.`)
  let current = item
  for (const step of MIGRATIONS.slice(start)) {
    current = step.migrate(current, context)
    if (current instanceof RemovedItem) return current
  }
  return current
}

function readReorder(value: unknown): ReorderRule {
  const rule = asFieldsOr(value, 'reorder')
  if (rule.kind === 'count' && typeof rule.atOrBelow === 'number') {
    return { kind: 'count', atOrBelow: rule.atOrBelow }
  }
  // Any number: the 1% to 100% range is a rule, which validateItem reports.
  if (rule.kind === 'share' && typeof rule.share === 'number') {
    return { kind: 'share', share: rule.share }
  }
  throw badField('reorder', 'a count rule or a share rule')
}

function asFieldsOr(value: unknown, field: string): Fields {
  if (!isFields(value)) throw badField(field, 'an object')
  return value
}

function optionalDate(fields: Fields, field: string): string | undefined {
  const value = fields[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw badField(field, 'a date as text')
  return value
}

/**
 * Checks that the chain's result really has the current Item shape and returns a fresh copy with
 * only Item's fields. Rules the type can't express (whole numbers, real dates, safe links) are
 * left to validateItem, which reports them instead of throwing.
 */
function readCurrentItem(input: unknown): Item {
  const item = asFields(input)
  if (item.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw badField('schemaVersion', String(CURRENT_SCHEMA_VERSION))
  }
  const id = requiredText(item, 'id')
  if (id === '') throw badField('id', 'non-empty text')
  const householdId = requiredText(item, 'householdId')
  if (householdId === '') throw badField('householdId', 'non-empty text')
  const category = item.category
  if (!isCategory(category)) throw badField('category', `one of ${CATEGORIES.join(', ')}`)
  const isExample = item.isExample
  if (typeof isExample !== 'boolean') throw badField('isExample', 'true or false')
  const deleted = item.deleted
  if (typeof deleted !== 'boolean') throw badField('deleted', 'true or false')
  const updatedAt = item.updatedAt
  if (typeof updatedAt !== 'string' || !isValidIsoDateTime(updatedAt)) {
    throw badField('updatedAt', 'a date and time such as 2026-11-15T09:30:00.000Z')
  }

  const result: Item = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    householdId,
    name: requiredText(item, 'name'),
    brand: requiredText(item, 'brand'),
    category,
    group: requiredText(item, 'group'),
    location: requiredText(item, 'location'),
    quantity: requiredNumber(item, 'quantity'),
    unit: requiredText(item, 'unit'),
    size: requiredText(item, 'size'),
    reorder: readReorder(item.reorder),
    buyUpTo: requiredNumber(item, 'buyUpTo'),
    notes: requiredText(item, 'notes'),
    isExample,
    deleted,
    updatedAt,
  }
  const lifeDays = item.lifeDays === undefined ? undefined : requiredNumber(item, 'lifeDays')
  const startedOn = optionalDate(item, 'startedOn')
  const expiresOn = optionalDate(item, 'expiresOn')
  const link = optionalText(item, 'link', '')
  if (link !== '') result.link = link
  if (lifeDays !== undefined) result.lifeDays = lifeDays
  if (startedOn !== undefined) result.startedOn = startedOn
  if (expiresOn !== undefined) result.expiresOn = expiresOn
  return result
}

/** The entries of a list of items, or of the prototype's map of id → item. */
function entriesOf(raw: unknown): Array<[key: string, value: unknown]> {
  if (Array.isArray(raw)) return raw.map((value: unknown, index) => [String(index), value])
  if (isFields(raw)) return Object.entries(raw)
  throw new MigrationError(
    'not-a-collection',
    'This data is not a list of items or a prototype map of items.',
  )
}

/** The same error, with the item's key added to its message and details. */
function located(error: MigrationError, itemKey: string): MigrationError {
  const details: { itemKey: string; field?: string } = { itemKey }
  if (error.field !== undefined) details.field = error.field
  return new MigrationError(error.code, `Item "${itemKey}": ${error.message}`, details)
}

/**
 * Upgrades every item in `raw` to CURRENT_SCHEMA_VERSION, then runs normalizeItem and
 * validateItem on each one.
 *
 * `raw` is either the prototype's stored map (`{ [id]: item }`) or a list of items. Each item is
 * migrated from its own version. An empty map or list is a valid, empty inventory.
 * The input is never changed: every returned item is a new object.
 *
 * @throws MigrationError when anything can't be migrated safely: not a collection, an entry that
 *   isn't an item, a version that is unreadable or newer than this app, a missing or wrongly
 *   typed field, or two items with the same id. Nothing is skipped or guessed.
 * @throws InvalidDateError if `context.today` isn't a valid date (a bug in the caller, not the data).
 */
export function migrateToCurrent(raw: unknown, context: MigrationContext): MigrationResult {
  if (!isValidIsoDate(context.today)) throw new InvalidDateError(context.today, 'migrateToCurrent')
  const items: MigratedItem[] = []
  const removed: RemovedEntry[] = []
  const seenIds = new Set<string>()

  for (const [key, value] of entriesOf(raw)) {
    try {
      const from = versionOf(value)
      const migrated = climb(value, from, context)
      if (migrated instanceof RemovedItem) {
        removed.push({ key, from, reason: migrated.reason })
        continue
      }
      const item = normalizeItem(readCurrentItem(migrated))
      if (seenIds.has(item.id)) {
        throw new MigrationError('duplicate-id', `Another item already has the id "${item.id}".`)
      }
      seenIds.add(item.id)
      items.push({ item, issues: validateItem(item), from })
    } catch (error) {
      throw error instanceof MigrationError ? located(error, key) : error
    }
  }
  return { items, removed }
}
