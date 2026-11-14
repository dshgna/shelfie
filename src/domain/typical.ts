// How long one of something typically lasts, guessed from its name, size, unit and category.
// Ported from the prototype's TYPICAL, HOME_CATS, parseSize, typicalFor and guessDays.
//
// Used by the importer (review shows "About N days · Typical") and by calcStock in stock.ts.
// Behaviour matches the prototype, oddities included; they are noted where they happen.

import type { Category, Unit } from './item'

/**
 * One rule: a pattern tested against the lowercased product name, the rough amount used per day
 * (ml or g; null when a size says nothing about how long it lasts, as with a toothbrush), and the
 * days one lasts when no size is known.
 */
export type TypicalRule = readonly [pattern: RegExp, dailyUse: number | null, days: number]

/**
 * Rough daily use and fallback lifetimes, per kind of product. Estimates only. First match wins.
 * Copied from the prototype as it is. Oddities kept: the patterns aren't anchored to whole words
 * and order matters, so for example "fabric conditioner" matches the hair conditioner rule,
 * "dish soap" the body wash rule, "dishwasher detergent" the laundry detergent rule and
 * "SPF lip balm" the sun cream rule. Prototype `TYPICAL`.
 */
export const TYPICAL: readonly TypicalRule[] = [
  [/cleansing (balm|oil)|oil cleanser/, 1.5, 70],
  [/micellar/, 5, 80],
  [/cleanser|face wash|foam/, 2, 75],
  [/toner/, 2, 75],
  [/essence/, 2, 75],
  [/serum|ampoule/, 0.5, 60],
  [/eye cream/, 0.2, 75],
  [/moistur|face cream|day cream/, 0.7, 70],
  [/spf|sun ?screen|sun ?cream/, 1.25, 40],
  [/mascara/, null, 90],
  [/shampoo/, 5, 50],
  [/conditioner/, 4, 60],
  [/body wash|shower gel|soap/, 5, 50],
  [/body lotion|body cream/, 5, 50],
  [/hand cream/, 2.5, 30],
  [/deodorant/, 0.8, 60],
  [/lip balm/, 0.05, 80],
  [/toothpaste/, 1.5, 50],
  [/toothbrush/, null, 90],
  [/floss/, null, 45],
  [/washing[- ]up/, 10, 45],
  [/laundry detergent|detergent/, 30, 50],
  [/fabric softener/, 20, 60],
  [/toilet cleaner/, 5, 60],
  [/bleach/, 10, 90],
  [/all-purpose|surface spray|glass cleaner|floor cleaner/, 15, 60],
]

/**
 * Categories where a bottle is assumed to last 90 days instead of 60. Prototype `HOME_CATS`,
 * without 'basics', which is no longer a category.
 */
export const HOME_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  'household',
  'kitchen',
  'bathroom',
  'laundry',
  'health',
])

/** What typicalFor found. */
export interface Typical {
  /** Days one lasts, always 1 or more. */
  days: number
  /** True when worked out from the size and daily use; false when it is the rule's fallback. */
  fromSize: boolean
}

/**
 * The amount in a size such as "250 ml", "1.5 l" or "3.4 fl oz", in ml or g, or undefined.
 * Litres and kilograms count as 1000; any ounce counts as 29.57 (fluid ounces).
 * Oddities kept: it reads the first number in the text, so "2 x 250 ml" is 2; a number with no
 * unit counts as ml or g, so "10 pieces" is 10; and only the first comma becomes a decimal point.
 * Prototype `parseSize`.
 */
function parseSize(size: string): number | undefined {
  const match = /(\d+(?:\.\d+)?)\s*(fl\.? ?oz|oz|ml|kg|g|l)?/.exec(
    size.toLowerCase().replace(',', '.'),
  )
  if (!match) return undefined
  let amount = Number.parseFloat(match[1] ?? '')
  const unit = match[2] ?? ''
  if (unit === 'l' || unit === 'kg') amount *= 1000
  else if (unit.includes('oz')) amount *= 29.57
  return amount > 0 ? amount : undefined
}

/**
 * A typical lifetime from the product's name and size, or undefined if no TYPICAL rule matches
 * the name. With a daily amount and a readable size: size / daily use, rounded, at least 1.
 * Otherwise the rule's fallback days. Prototype `typicalFor` (which returned null for no match).
 */
export function typicalFor(name: string, size: string): Typical | undefined {
  const lower = name.toLowerCase()
  const rule = TYPICAL.find(([pattern]) => pattern.test(lower))
  if (!rule) return undefined
  const [, dailyUse, days] = rule
  const amount = parseSize(size)
  if (dailyUse !== null && amount !== undefined) {
    return { days: Math.max(1, Math.round(amount / dailyUse)), fromSize: true }
  }
  return { days, fromSize: false }
}

/**
 * A typical lifetime in days, always 1 or more: typicalFor when a rule matches, otherwise by unit
 * (tube 45, bar 30, bottle 90 in home categories or 60, anything else 60). Prototype `guessDays`.
 */
export function guessDays(name: string, size: string, unit: Unit, category: Category): number {
  const typical = typicalFor(name, size)
  if (typical) return typical.days
  if (unit === 'tube') return 45
  if (unit === 'bar') return 30
  if (unit === 'bottle') return HOME_CATEGORIES.has(category) ? 90 : 60
  return 60
}
