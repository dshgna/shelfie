// The one status chip on an item's card: the most urgent thing to know, in words, with an icon
// from design/assets/status. Ported from the prototype's chipFor. Which state an item is in comes
// from src/domain (status, dueByTime, timing, reorderAt); this file only words it. The chip never
// relies on colour alone: it always has text, and an icon that differs by kind.

import { daysUntil, type IsoDate } from '../domain/dates'
import type { Item } from '../domain/item'
import { assertNever, dueByTime, reorderAt, status, timing } from '../domain/status'

/** Which icon and tone the chip uses. */
export type ChipKind = 'expired' | 'out' | 'order' | 'low' | 'use-soon' | 'left'

/** How urgent it looks: 'bad' (red text), 'warn' (amber text) or 'ok' (green text). */
export type ChipTone = 'bad' | 'warn' | 'ok'

export interface StatusLabel {
  kind: ChipKind
  tone: ChipTone
  text: string
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/** Percent of the one in use that is left, from timing(): 0 to 100. */
function percentLeft(used: number): number {
  return Math.round(Math.max(0, 1 - used) * 100)
}

/** The chip for an item on `today`. */
export function statusLabel(item: Item, today: IsoDate): StatusLabel {
  const state = status(item, today)
  const t = timing(item, today)
  switch (state) {
    case 'expired': {
      const ago = Math.abs(daysUntil(today, item.expiresOn ?? today))
      return { kind: 'expired', tone: 'bad', text: `Expired ${days(ago)} ago` }
    }
    case 'out':
      return { kind: 'out', tone: 'bad', text: 'Out of stock' }
    case 'due':
      // 'due' is either due by time (the one in use is nearly used up) or low by count.
      if (t && dueByTime(item, today)) {
        return t.over
          ? { kind: 'order', tone: 'bad', text: 'Order now · past estimate' }
          : { kind: 'order', tone: 'warn', text: `Order now · ${percentLeft(t.used)}% left` }
      }
      return { kind: 'low', tone: 'warn', text: `Low · ${item.quantity} left` }
    case 'near-expiry': {
      const left = daysUntil(today, item.expiresOn ?? today)
      return { kind: 'use-soon', tone: 'warn', text: `Use within ${days(left)}` }
    }
    case 'ok': {
      const byShare = t !== undefined && reorderAt(item).kind === 'share'
      const text =
        item.quantity === 1 && byShare ? `${percentLeft(t.used)}% left` : `${item.quantity} left`
      return { kind: 'left', tone: 'ok', text }
    }
    default:
      return assertNever(state)
  }
}
