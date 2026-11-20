// Invariants: rules that must hold for every input, checked over many generated inputs in plain
// loops. Each loop collects every failure and makes one assertion at the end, so a failure lists
// all the inputs that broke the rule, not just the first.
//
// All dates are worked out with dates.ts (UTC calendar arithmetic), so nothing here depends on the
// machine's time zone.

import { describe, expect, it } from 'vitest'
import { daysUntil, plusDays } from '../dates'
import type { Item, ReorderRule } from '../item'
import { STATUSES, status } from '../status'
import { TODAY, makeItem } from './helpers/fixtures'
import { normalizeItem, validateItem } from '../validate'

/** Every calendar day from `first` to `last`, both included. */
function everyDay(first: string, last: string): string[] {
  const days: string[] = []
  for (let n = 0; n <= daysUntil(first, last); n++) days.push(plusDays(first, n))
  return days
}

/** Freezes an object and everything inside it, so any attempt to change it throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/**
 * A deep copy to compare against later. Not a JSON copy: JSON turns NaN into null, and the grid
 * has NaN quantities on purpose.
 */
function snapshot<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  const copy: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) copy[key] = snapshot(child)
  return copy as T
}

/**
 * A grid of invented items covering the fields the rules look at: stock, lifetime, start date,
 * expiry date and reorder rule, including edge values validation would report.
 */
function itemGrid(): Item[] {
  const quantities = [0, 1, 2, 3, 2.5, -1, Number.NaN]
  const lifetimes = [undefined, 0, 1, 30, 45]
  const startedDaysAgo = [undefined, 0, 1, 26, 27, 28, 60]
  const expiresInDays = [undefined, -1, 0, 1, 60, 61]
  const rules: ReorderRule[] = [
    { kind: 'count', atOrBelow: 0 },
    { kind: 'count', atOrBelow: 1 },
    { kind: 'count', atOrBelow: 2 },
    { kind: 'share', share: 0.33 },
    { kind: 'share', share: 0.9 },
    { kind: 'share', share: 1 },
  ]
  const items: Item[] = []
  for (const quantity of quantities)
    for (const lifeDays of lifetimes)
      for (const started of startedDaysAgo)
        for (const expires of expiresInDays)
          for (const reorder of rules) {
            const item = makeItem({ id: `grid-${items.length}`, quantity, reorder })
            if (lifeDays !== undefined) item.lifeDays = lifeDays
            if (started !== undefined) item.startedOn = plusDays(TODAY, -started)
            if (expires !== undefined) item.expiresOn = plusDays(TODAY, expires)
            items.push(item)
          }
  return items
}

describe('invariants', () => {
  it('plusDays then daysUntil gives back the days added, for every day of 2026 to 2029', () => {
    // Four years: 2028 is a leap year, and each year has both daylight saving changes.
    const offsets = [-400, -366, -365, -31, -1, 0, 1, 27, 30, 365, 366, 400]
    const failures: string[] = []
    for (const day of everyDay('2026-01-01', '2029-12-31')) {
      for (const n of offsets) {
        const later = plusDays(day, n)
        if (daysUntil(day, later) !== n) failures.push(`daysUntil(${day}, ${later}) is not ${n}`)
        if (plusDays(later, -n) !== day) failures.push(`plusDays(${later}, ${-n}) is not ${day}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('normalizeItem is idempotent and never changes its input', () => {
    const failures: string[] = []
    for (const item of itemGrid()) {
      const before = snapshot(item)
      const once = normalizeItem(deepFreeze(item)) // frozen: any change to the input throws
      const twice = normalizeItem(once)
      try {
        expect(twice).toEqual(once)
        expect(item).toEqual(before)
      } catch {
        failures.push(item.id)
      }
    }
    expect(failures).toEqual([])
  })

  it('status only ever returns one of the five states, across a grid of items and dates', () => {
    const allowed: readonly string[] = STATUSES
    const failures: string[] = []
    const items = itemGrid()
    for (const today of [
      TODAY,
      '2026-03-08',
      '2026-03-29',
      '2026-10-25',
      '2026-11-01',
      '2028-02-29',
    ]) {
      for (const item of items) {
        const result: string = status(item, today)
        if (!allowed.includes(result)) failures.push(`${item.id} on ${today}: ${result}`)
      }
    }
    expect(failures).toEqual([])
    // 7 quantities x 5 lifetimes x 7 start dates x 6 expiry dates x 6 rules, on 6 days each.
    expect(items.length).toBe(8820)
  })

  it('validateItem finds nothing wrong with the makeItem() defaults', () => {
    expect(validateItem(makeItem())).toEqual([])
  })

  // Guards the test setup, not the code: domain tests must run in Node, where browser globals
  // don't exist. Fails if a config change (for example jsdom for UI tests) reaches src/domain.
  it('domain tests run without browser globals', () => {
    // eslint-disable-next-line no-restricted-globals -- this test checks that they do NOT exist
    expect(['window', 'document'].filter((name) => name in globalThis)).toEqual([])
  })
})
