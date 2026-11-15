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
import type { IsoDate, Item } from './item'
import { isValidRecordQuantity, type ItemPurchaseRecord } from './item-purchase-record'
import { guessDays } from './typical'

export interface StockEstimate {
  /** Days one lasts: the purchase's own lifeDays, or the guess. Always 1 or more. */
  lifeDays: number
  /** Units already used up: whole lifetimes since the purchase, never more than `quantity`. */
  used: number
  /** Units probably left: `quantity - used`, never below 0. */
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
 * Prototype `calcStock`.
 *
 * It takes only the fields it uses, so both a saved ItemPurchaseRecord (with its item's name and
 * category) and an import line that hasn't been saved yet can be passed in:
 * - `quantity`: units bought, a whole number, 1 or more (isValidRecordQuantity). How a multipack
 *   is counted is decided before this, by the import preference "Count each item" (default: a
 *   pack of 3 ordered twice is 6) or "Count a multipack as one".
 * - `boughtAt`: the purchase date. Left out means bought today, as in the prototype; a date after
 *   today also counts as today.
 * - `lifeDays`: days one lasts, if the person entered it (prototype `lifeOver`). Left out, or 0
 *   or less, means it is guessed with guessDays from `name`, `size`, `unit` and `category`.
 * - `name`, `size`, `unit` and `category` are used only for that guess.
 *
 * @throws RangeError if `quantity` isn't a whole number, 1 or more.
 * @throws InvalidDateError if `boughtAt` or `today` isn't a valid date.
 */
export function calcStock(
  purchase: Pick<ItemPurchaseRecord, 'quantity' | 'size' | 'unit'> &
    Partial<Pick<ItemPurchaseRecord, 'boughtAt'>> &
    Pick<Item, 'name' | 'category' | 'lifeDays'>,
  today: IsoDate,
): StockEstimate {
  const { quantity } = purchase
  if (!isValidRecordQuantity(quantity)) {
    throw new RangeError(`calcStock: quantity ${quantity} is not a whole number, 1 or more`)
  }
  const life =
    purchase.lifeDays !== undefined && purchase.lifeDays > 0
      ? purchase.lifeDays
      : guessDays(purchase.name, purchase.size, purchase.unit, purchase.category)
  const bought = purchase.boughtAt ?? today
  const days = Math.max(0, daysUntil(bought, today))
  const used = Math.min(quantity, Math.floor(days / life))
  const left = quantity - used
  const estimate: StockEstimate = { lifeDays: life, used, left }
  // With a fractional lifeDays, used * life isn't whole. The prototype's setDate dropped the
  // fraction (30.5 days became 30), so Math.trunc does the same; the result is never negative.
  if (left > 0) estimate.startedOn = plusDays(bought, Math.trunc(used * life))
  return estimate
}
