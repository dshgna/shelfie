// Stock and expiry status, ported from the prototype's status, dueByTime, needsRestock,
// needsExpiry, timing and pctMode, and the priority order of its item label (chipFor).
// Behaviour matches the prototype, oddities included, except: its "low" status is part of 'due',
// its "soon" is called 'near-expiry', and DEFAULT_SHARE is 0.9 instead of 0.5.

import { daysUntil, plusDays } from './dates'
import type { IsoDate, Item, ReorderRule, ReorderShare } from './item'

/**
 * Every status an item can have, most urgent first:
 * - 'expired': its expiry date has passed;
 * - 'out': none left;
 * - 'due': time to reorder, either low by count/percentage share;
 * - 'near-expiry': expires within SOON_DAYS, today included (the prototype's "soon");
 * - 'ok': none of the above.
 * Same order as the prototype's item label (chipFor), with low folded into due.
 */
export const STATUSES = ['expired', 'out', 'due', 'near-expiry', 'ok'] as const

export type Status = (typeof STATUSES)[number]

/** An expiry within this many days (today included) counts as near expiry. Prototype SOON_DAYS. */
export const SOON_DAYS = 60

/**
 * Share of the one in use's life used before reordering when the item has no share of its own:
 * 0.9 used, which is "reorder when 10% is left". Shelfie's choice; the prototype's form stores 0.5.
 */
export const DEFAULT_SHARE: ReorderShare = 0.9

/** Called where every case has been handled. If a case is missed, `value` isn't `never` and this won't compile. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`)
}

function hasLife(item: Item): boolean {
  return item.lifeDays !== undefined && item.lifeDays > 0
}

/**
 * The reorder rule that actually applies (the prototype's `min` and `pct` together):
 * - a share rule as stored;
 * - a count rule at 0 on an item with a lifetime becomes a share rule at DEFAULT_SHARE, because
 *   "reorder when none are left" can't be reached while one is open (prototype pctMode);
 * - any other count rule as stored.
 */
export function reorderAt(item: Item): ReorderRule {
  const rule = item.reorder
  if (rule.kind === 'count' && rule.atOrBelow === 0 && hasLife(item)) {
    return { kind: 'share', share: DEFAULT_SHARE }
  }
  return rule
}

/** The share used for timing: the rule's own, or DEFAULT_SHARE for count rules. */
function shareFor(rule: ReorderRule): ReorderShare {
  return rule.kind === 'share' ? rule.share : DEFAULT_SHARE
}

/** The prototype's pctMode: reorder by share of the one in use, which needs a lifetime. */
function byShare(item: Item): boolean {
  return hasLife(item) && reorderAt(item).kind === 'share'
}

export interface Timing {
  /** Share of the one in use's life that has passed (0 or more; over 1 when past its life). */
  used: number
  /** Days until it should be reordered; 0 or less means now. */
  reorderIn: number
  /** The date it should be reordered. */
  reorderOn: IsoDate
  /** True once the whole estimated life has passed. */
  over: boolean
}

/**
 * Replacement timing for the one in use, or undefined when it can't be worked out: no lifetime,
 * no start date, or nothing in stock. Prototype `timing`.
 */
export function timing(item: Item, today: IsoDate): Timing | undefined {
  const life = item.lifeDays
  if (life === undefined || !(life > 0) || item.startedOn === undefined || item.quantity < 1) {
    return undefined
  }
  const elapsed = daysUntil(item.startedOn, today)
  // Math.round rounds halves up, as in the prototype: 45 days at 0.9 (40.5) is due on day 41.
  const due = Math.round(life * shareFor(reorderAt(item)))
  return {
    used: Math.max(0, elapsed / life),
    reorderIn: due - elapsed,
    reorderOn: plusDays(item.startedOn, due),
    over: elapsed >= life,
  }
}

/**
 * How many the item aims to have after shopping: the larger of `buyUpTo` and one more than the
 * stored count rule's `atOrBelow` (a share rule counts as 0). Prototype `target`:
 * max(par, min + 1). Never below 1.
 */
export function stockTarget(item: Item): number {
  const atOrBelow = item.reorder.kind === 'count' ? item.reorder.atOrBelow : 0
  return Math.max(item.buyUpTo, atOrBelow + 1)
}

/**
 * How full the item looks on its stock bar, from 0 (none) to 1 (full). Prototype itemHtml's
 * `frac`:
 * - when timing() can be worked out (a lifetime, a start date and at least one in stock), the
 *   share of the one in use that is left: 1 - used, never below 0;
 * - otherwise quantity over stockTarget(), never above 1.
 * It only drives the bar: whether to restock is still needsRestock's call.
 */
export function stockLeft(item: Item, today: IsoDate): number {
  const t = timing(item, today)
  if (t !== undefined) return Math.min(1, Math.max(0, 1 - t.used))
  return Math.min(1, Math.max(0, item.quantity / stockTarget(item)))
}

/**
 * How many to buy to get back to stockTarget(), and always at least 1, since an item is only on
 * the shopping list when needsRestock says it needs buying. Prototype `buyFor` (before the person
 * types their own number).
 */
export function buyCount(item: Item): number {
  return Math.max(1, stockTarget(item) - item.quantity)
}

/**
 * True when the one in use is due for replacement by time: share mode, its reorder date has
 * arrived, and it is the last one (quantity 1). Oddity kept: with 2 or more in stock this is
 * never true, however old the open one is. Prototype `dueByTime`.
 */
export function dueByTime(item: Item, today: IsoDate): boolean {
  const t = timing(item, today)
  return t !== undefined && byShare(item) && t.reorderIn <= 0 && item.quantity <= 1
}

/** The prototype's separate status flags. More than one can be true at once. */
interface Flags {
  out: boolean
  low: boolean
  expired: boolean
  soon: boolean
  due: boolean
}

function flags(item: Item, today: IsoDate): Flags {
  const days = item.expiresOn === undefined ? undefined : daysUntil(today, item.expiresOn)
  const rule = reorderAt(item)
  // Share rules have no count threshold (the prototype stores min = 0), so they are never "low".
  const lowAt = rule.kind === 'count' ? rule.atOrBelow : 0
  return {
    out: item.quantity <= 0,
    low: item.quantity > 0 && item.quantity <= lowAt,
    // Oddity kept: an expiry date of today is near expiry, not expired.
    expired: days !== undefined && days < 0,
    soon: days !== undefined && days >= 0 && days <= SOON_DAYS,
    due: dueByTime(item, today),
  }
}

function holds(state: Status, f: Flags): boolean {
  switch (state) {
    case 'expired':
      return f.expired
    case 'out':
      return f.out
    case 'due':
      return f.low || f.due
    case 'near-expiry':
      return f.soon
    case 'ok':
      return true
    default:
      return assertNever(state)
  }
}

/**
 * The single most urgent status of an item on `today`, in the prototype's label order.
 * @throws InvalidDateError if startedOn or expiresOn isn't a valid date (validate at the boundary).
 */
export function status(item: Item, today: IsoDate): Status {
  const f = flags(item, today)
  return STATUSES.find((state) => holds(state, f)) ?? 'ok'
}

/** Out of stock, low, or due by time. Drives the shopping list and the jar's "worried" mood. */
export function needsRestock(item: Item, today: IsoDate): boolean {
  const f = flags(item, today)
  return f.out || f.low || f.due
}

/** Expired, or expiring within SOON_DAYS. */
export function needsExpiry(item: Item, today: IsoDate): boolean {
  const f = flags(item, today)
  return f.expired || f.soon
}
