// The inventory item, as stored on the device and (encrypted) in sync.
// Ported from the prototype's item shape (version `v: 6`). Prototype field names are noted
// beside each field so the prototype importer (a later item) can map them.

import type { IsoDate } from './dates'

/** IsoDate lives in dates.ts; re-exported so existing `import { IsoDate } from './item'` works. */
export type { IsoDate }

/**
 * The shape version of every stored record: items, users and households all share it. Bump it
 * whenever the stored shape of any of them changes, and add a migration for each record type.
 */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * An absolute web address starting with http:// or https://. Checked by `isSafeLink` in
 * validate.ts, which also flags http:// as insecure. Links are never upgraded or dropped.
 */
export type Link = string

/**
 * Shelfie's 9 categories, in the prototype's display order. The prototype also has 'basics'
 * (Household Basics), which was removed here on purpose: migrations.ts moves those items to
 * 'household', keeping their group.
 */
export const CATEGORIES = [
  'skincare',
  'hair',
  'beauty',
  'dental',
  'household',
  'kitchen',
  'bathroom',
  'laundry',
  'health',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * A group (shelf) inside a category, such as "Dishwashing" or "Step 3 · Toner".
 * Each category has default groups, but people can type their own, so this is any text.
 */
export type Group = string

/**
 * Each category's default groups, in display order. Prototype `CATS[cat].subs` (skincare's come
 * from the routine `STEPS`). The prototype's pickers also offer 'Other' in every category.
 * 'basics' (Paper Goods, Batteries & Bulbs, Other Basics) is left out with its category.
 */
export const DEFAULT_GROUPS: Readonly<Record<Category, readonly Group[]>> = {
  skincare: [
    'Step 1 · Oil Cleanser',
    'Step 2 · Water Cleanser',
    'Step 3 · Toner',
    'Step 4 · Essence',
    'Step 5 · Serum or Ampoule',
    'Step 6 · Moisturiser',
    'Step 7 · Sun Protection',
    'Eye Cream',
  ],
  hair: ['Body Soap', 'Shampoo', 'Conditioner', 'Hand Soap'],
  beauty: ['Body Creams', 'Make-Up', 'Tools & Accessories'],
  dental: ['Dental Care'],
  household: ['Floors, Surfaces & Cloths'],
  kitchen: ['Dishwashing', 'Oven & Surfaces', 'Waste & Paper', 'Hand Soap'],
  bathroom: ['Cleaning', 'Toilet Paper'],
  laundry: ['Washing', 'Stain & Fabric Care'],
  health: ['First Aid', 'Medicines'],
}

/** The units the prototype offers in its picker. */
export const KNOWN_UNITS = [
  // Containers
  'bottle',
  'tube',
  'jar',
  'tub',
  'pot',
  'pump',
  'can',
  'spray',
  'carton',
  'sachet',
  'refill',
  // Packs & rolls
  'pack',
  'box',
  'bag',
  'roll',
  'sheet',
  'wipe',
  'pad',
  'bar',
  // Tools & cloths
  'brush',
  'sponge',
  'cloth',
  'head',
  'pair',
  // Counted items
  'tablet',
  'capsule',
  'plaster',
  'stick',
  'battery',
  'bulb',
  'piece',
  'set',
  'load',
  'dose',
] as const

export type KnownUnit = (typeof KNOWN_UNITS)[number]

/**
 * A known unit, or any unit the person typed ("Other…" in the prototype).
 * `string & {}` keeps editor suggestions for the known units while still allowing any text.
 */
export type Unit = KnownUnit | (string & {})

/**
 * How much of the one in use has been used up when it is time to reorder (0.9 = 10% left).
 * Any percentage from 1% to 100% with at most 2 decimals: 0.01 to 1, such as 0.25 or 0.33.
 * The type can't express that range, so `validateItem` in validate.ts reports 'invalid-share'.
 */
export type ReorderShare = number

/**
 * When an item needs reordering. It is one of two kinds:
 * - `count`: reorder when `quantity` is at or below `atOrBelow` (prototype `min`).
 *   `atOrBelow: 0` means only when it runs out.
 * - `share`: reorder once `share` of the one in use's life has passed (prototype `min: 0` + `pct`).
 *   Needs `lifeDays` greater than 0: `validateItem` in validate.ts reports 'share-without-life'.
 */
export type ReorderRule =
  { kind: 'count'; atOrBelow: number } | { kind: 'share'; share: ReorderShare }

/** The item's two optional web pages. */
export interface ItemLinks {
  /** Product page (prototype `link`). */
  product?: Link
  /** Brand page (prototype `blink`). */
  brand?: Link
}

/**
 * One thing on a shelf.
 * Text fields are always present and use '' for "not set", as in the prototype.
 * Dates, links and lifeDays are left out when not set, because '' or 0 isn't a real date,
 * address or lifetime.
 */
export interface Item {
  schemaVersion: number
  /** Unique within the person's inventory. */
  id: string
  name: string
  /** '' when not known. */
  brand: string
  /** Prototype `cat`. */
  category: Category
  /** Prototype `sub`. */
  group: Group
  /** Where it is kept, e.g. "Bathroom shelf"; '' when not set (prototype `loc`). */
  location: string
  /** How many are in stock (prototype `qty`). Whole number, 0 or more: checked by validateItem. */
  quantity: number
  unit: Unit
  /** Free text such as "500 ml"; '' when not set. */
  size: string
  /**
   * About how many days one lasts (prototype `life`; 0 there means not set).
   * Whole number, 0 or more: checked by validateItem.
   */
  lifeDays?: number
  /**
   * When the one in use was started (prototype `start`). Only kept while lifeDays > 0 and
   * quantity > 0: validateItem reports it otherwise, and normalizeItem clears it.
   */
  startedOn?: IsoDate
  /** Prototype `min` and `pct`. */
  reorder: ReorderRule
  /** How many to have after shopping (prototype `par`). Whole number, 0 or more: checked by validateItem. */
  buyUpTo: number
  /** Prototype `expiry`. */
  expiresOn?: IsoDate
  /** Free text; '' when empty (prototype `note`). */
  notes: string
  links: ItemLinks
  /** True for the example items the app adds for new users, so they can be removed in one go. */
  isExample: boolean
}
