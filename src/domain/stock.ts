// Stock estimate for a purchase, ported from the prototype's calcStock. The lifetime guess it
// relies on (guessDays) lives in typical.ts.
//
// In the prototype this runs once per line of a pasted or screenshot order ("Fill my shelves"):
// it works out how many of the units bought are probably still left today, and when the one in
// use was opened. The importer (a later item) turns the result into an Item's quantity,
// lifeDays and startedOn. After that, status.ts takes over.
//
// Behaviour matches the prototype, oddities included; they are noted where they happen.

import { daysUntil, plusDays } from './dates'
import type { Category, IsoDate, Unit } from './item'
import { guessDays } from './typical'

/**
 * One line of a purchase, as the prototype's import review shows it (a prototype import row).
 * Not an Item: turning a Purchase and its StockEstimate into an Item is the importer's job.
 */
export interface Purchase {
  /**
   * Required. Units bought: a whole number, 0 or more (the prototype's import allows 1 to 99).
   * How a multipack is counted is decided before this, by the import preference "Count each
   * item" (default: a pack of 3 ordered twice is 6) or "Count a multipack as one".
   */
  count: number
  /** Optional. The purchase date. Left out means bought today, as in the prototype. */
  boughtOn?: IsoDate
  /**
   * Optional. Days one lasts, if the person entered it (prototype `lifeOver`). Left out, or 0 or
   * less, means it is guessed from name, size, unit and category with guessDays.
   */
  lifeDays?: number
  /** Required. Product name; used only to guess the lifetime ("Shampoo", "Vitamin C serum"). */
  name: string
  /** Required, may be ''. Size text such as "250 ml"; used only to guess the lifetime. */
  size: string
  /** Required. Unit; used only for the guess when no product rule matches (tube, bar, bottle). */
  unit: Unit
  /** Required. Category; used only for the bottle guess (90 days in home categories, else 60). */
  category: Category
}

export interface StockEstimate {
  /** Days one lasts: the purchase's own lifeDays, or the guess. Always 1 or more. */
  lifeDays: number
  /** Units already used up: whole lifetimes since the purchase, never more than `count`. */
  used: number
  /** Units probably left: `count - used`, never below 0. */
  left: number
  /**
   * When the one in use was opened: the purchase date plus `used` whole lifetimes.
   * Left out when nothing is left (the prototype stores '').
   */
  startedOn?: IsoDate
}

/**
 * How many of the units bought are probably left on `today`, and when the open one was started.
 * Units bought minus whole lifetimes passed since the purchase date, never below 0.
 * Exactly on a lifetime boundary, that unit counts as used up and the next one starts that day.
 * A purchase date after today counts as bought today. Prototype `calcStock`.
 *
 * @throws RangeError if `count` isn't a whole number, 0 or more.
 * @throws InvalidDateError if `boughtOn` or `today` isn't a valid date.
 */
export function calcStock(purchase: Purchase, today: IsoDate): StockEstimate {
  const { count } = purchase
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`calcStock: count ${count} is not a whole number, 0 or more`)
  }
  const life =
    purchase.lifeDays !== undefined && purchase.lifeDays > 0
      ? purchase.lifeDays
      : guessDays(purchase.name, purchase.size, purchase.unit, purchase.category)
  const bought = purchase.boughtOn ?? today
  const days = Math.max(0, daysUntil(bought, today))
  const used = Math.min(count, Math.floor(days / life))
  const left = count - used
  const estimate: StockEstimate = { lifeDays: life, used, left }
  // With a fractional lifeDays, used * life isn't whole. The prototype's setDate dropped the
  // fraction (30.5 days became 30), so Math.trunc does the same; the result is never negative.
  if (left > 0) estimate.startedOn = plusDays(bought, Math.trunc(used * life))
  return estimate
}
