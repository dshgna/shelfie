import { describe, expect, it } from 'vitest'
import { InvalidDateError, plusDays } from '../dates'
import type { Item } from '../item'
import {
  DEFAULT_SHARE,
  STATUSES,
  assertNever,
  dueByTime,
  needsExpiry,
  needsRestock,
  reorderAt,
  buyCount,
  status,
  stockLeft,
  stockTarget,
  timing,
  type Status,
} from '../status'
import { TODAY, makeItem } from './helpers/fixtures'

// Invented example data. makeItem's default: 3 in stock, reorder at 1, no lifetime, no
// expiry, so status 'ok'. All dates are relative to TODAY.
const daysAgo = (n: number) => plusDays(TODAY, -n)
const inDays = (n: number) => plusDays(TODAY, n)

/** One open bottle, 30-day life, reorder when 90% used: due 27 days after it was started. */
function shareItem(overrides: Partial<Item> = {}): Item {
  return makeItem({
    quantity: 1,
    lifeDays: 30,
    startedOn: daysAgo(10),
    reorder: { kind: 'share', share: 0.9 },
    ...overrides,
  })
}

describe('stock by count', () => {
  it.each([
    { case: 'zero stock', quantity: 0, atOrBelow: 2, expected: 'out' },
    { case: 'one below the threshold', quantity: 1, atOrBelow: 2, expected: 'due' },
    { case: 'exactly at the threshold', quantity: 2, atOrBelow: 2, expected: 'due' },
    { case: 'one above the threshold', quantity: 3, atOrBelow: 2, expected: 'ok' },
    { case: 'threshold 0, one left', quantity: 1, atOrBelow: 0, expected: 'ok' },
    { case: 'threshold 0, none left', quantity: 0, atOrBelow: 0, expected: 'out' },
    { case: 'negative stock', quantity: -1, atOrBelow: 2, expected: 'out' },
  ] satisfies Array<{ case: string; quantity: number; atOrBelow: number; expected: Status }>)(
    '$case is $expected',
    ({ quantity, atOrBelow, expected }) => {
      const item = makeItem({ quantity, reorder: { kind: 'count', atOrBelow } })
      expect(status(item, TODAY)).toBe(expected)
      expect(needsRestock(item, TODAY)).toBe(expected !== 'ok')
    },
  )
})

describe('expiry', () => {
  it.each([
    { case: 'expired yesterday', expiresOn: daysAgo(1), expected: 'expired' },
    {
      case: 'expires today (near expiry, not expired)',
      expiresOn: TODAY,
      expected: 'near-expiry',
    },
    { case: 'expires tomorrow', expiresOn: inDays(1), expected: 'near-expiry' },
    { case: 'expires in exactly 60 days', expiresOn: inDays(60), expected: 'near-expiry' },
    { case: 'expires in 61 days', expiresOn: inDays(61), expected: 'ok' },
    { case: 'no expiry date', expiresOn: undefined, expected: 'ok' },
  ] satisfies Array<{ case: string; expiresOn: string | undefined; expected: Status }>)(
    '$case is $expected',
    ({ expiresOn, expected }) => {
      const item = makeItem({ expiresOn })
      expect(status(item, TODAY)).toBe(expected)
      expect(needsExpiry(item, TODAY)).toBe(expected !== 'ok')
      expect(needsRestock(item, TODAY)).toBe(false)
    },
  )

  it('throws on a corrupt expiry date instead of hiding it', () => {
    expect(() => status(makeItem({ expiresOn: '2026-02-30' }), TODAY)).toThrow(InvalidDateError)
  })
})

describe('reorderAt', () => {
  it.each([
    {
      case: 'a share rule stays as stored',
      item: shareItem({ reorder: { kind: 'share', share: 0.5 } }),
      expected: { kind: 'share', share: 0.5 },
    },
    {
      case: 'count at 0 with a lifetime becomes the default share',
      item: shareItem({ reorder: { kind: 'count', atOrBelow: 0 } }),
      expected: { kind: 'share', share: DEFAULT_SHARE },
    },
    {
      case: 'count at 0 without a lifetime stays a count',
      item: makeItem({ reorder: { kind: 'count', atOrBelow: 0 } }),
      expected: { kind: 'count', atOrBelow: 0 },
    },
    {
      case: 'count above 0 with a lifetime stays a count',
      item: shareItem({ reorder: { kind: 'count', atOrBelow: 2 } }),
      expected: { kind: 'count', atOrBelow: 2 },
    },
  ])('$case', ({ item, expected }) => {
    expect(reorderAt(item)).toEqual(expected)
  })

  it('defaults to reordering when 10% is left', () => {
    expect(DEFAULT_SHARE).toBe(0.9)
  })
})

describe('due by time', () => {
  it.each([
    // 30 days x 0.9 = 27: due from the 27th day after starting.
    {
      case: 'the day before the boundary',
      item: shareItem({ startedOn: daysAgo(26) }),
      due: false,
    },
    { case: 'on the boundary', item: shareItem({ startedOn: daysAgo(27) }), due: true },
    { case: 'the day after the boundary', item: shareItem({ startedOn: daysAgo(28) }), due: true },
    { case: 'long past its whole life', item: shareItem({ startedOn: daysAgo(90) }), due: true },
    // Math.round rounds halves up: 45 x 0.9 = 40.5 becomes 41.
    {
      case: 'a half day rounded up, day 40',
      item: shareItem({ lifeDays: 45, startedOn: daysAgo(40) }),
      due: false,
    },
    {
      case: 'a half day rounded up, day 41',
      item: shareItem({ lifeDays: 45, startedOn: daysAgo(41) }),
      due: true,
    },
    // Oddity: with 2 or more in stock it is never due by time.
    {
      case: 'past due but 2 in stock',
      item: shareItem({ quantity: 2, startedOn: daysAgo(28) }),
      due: false,
    },
    { case: 'no lifetime', item: shareItem({ lifeDays: undefined }), due: false },
    { case: 'a lifetime of 0', item: shareItem({ lifeDays: 0 }), due: false },
    { case: 'no start date', item: shareItem({ startedOn: undefined }), due: false },
    { case: 'a start date in the future', item: shareItem({ startedOn: inDays(5) }), due: false },
    // Count mode at 0 with a lifetime uses DEFAULT_SHARE (0.9, 10% left): 30 x 0.9 = due on day 27.
    {
      case: 'count at 0 with a lifetime, day 26',
      item: shareItem({ reorder: { kind: 'count', atOrBelow: 0 }, startedOn: daysAgo(26) }),
      due: false,
    },
    {
      case: 'count at 0 with a lifetime, day 27',
      item: shareItem({ reorder: { kind: 'count', atOrBelow: 0 }, startedOn: daysAgo(27) }),
      due: true,
    },
  ])('$case: due $due', ({ item, due }) => {
    expect(dueByTime(item, TODAY)).toBe(due)
    expect(status(item, TODAY)).toBe(due ? 'due' : 'ok')
    expect(needsRestock(item, TODAY)).toBe(due)
  })

  it('is never due by time in count mode above 0, only low by count', () => {
    const item = shareItem({ reorder: { kind: 'count', atOrBelow: 1 }, startedOn: daysAgo(90) })
    expect(dueByTime(item, TODAY)).toBe(false)
    expect(status(item, TODAY)).toBe('due')
  })

  it('works out the timing details', () => {
    expect(timing(shareItem({ startedOn: daysAgo(27) }), TODAY)).toEqual({
      used: 0.9,
      reorderIn: 0,
      reorderOn: TODAY,
      over: false,
    })
    expect(timing(shareItem({ startedOn: daysAgo(30) }), TODAY)?.over).toBe(true)
    expect(timing(shareItem({ quantity: 0 }), TODAY)).toBeUndefined()
  })
})

describe('priority when several are true', () => {
  it.each([
    {
      case: 'expired and out',
      item: makeItem({ quantity: 0, expiresOn: daysAgo(1) }),
      expected: 'expired',
    },
    {
      case: 'expired and low by count',
      item: makeItem({ quantity: 1, expiresOn: daysAgo(1) }),
      expected: 'expired',
    },
    {
      case: 'out and near expiry',
      item: makeItem({ quantity: 0, expiresOn: inDays(5) }),
      expected: 'out',
    },
    {
      case: 'due by time and near expiry',
      item: shareItem({ startedOn: daysAgo(28), expiresOn: inDays(5) }),
      expected: 'due',
    },
    {
      case: 'due and expired',
      item: shareItem({ startedOn: daysAgo(28), expiresOn: daysAgo(1) }),
      expected: 'expired',
    },
    {
      case: 'low by count and near expiry',
      item: makeItem({ quantity: 1, expiresOn: inDays(5) }),
      expected: 'due',
    },
  ] satisfies Array<{ case: string; item: Item; expected: Status }>)(
    '$case is $expected',
    ({ item, expected }) => {
      expect(status(item, TODAY)).toBe(expected)
      // The separate checks still see every condition.
      expect(needsRestock(item, TODAY) && needsExpiry(item, TODAY)).toBe(true)
    },
  )
})

describe('Status', () => {
  it('lists the five states, most urgent first', () => {
    expect(STATUSES).toEqual(['expired', 'out', 'due', 'near-expiry', 'ok'])
  })

  it('assertNever throws if reached at runtime', () => {
    expect(() => assertNever('surprise' as never)).toThrow('Unhandled value: surprise')
  })
})

describe('boundaries added in the test review', () => {
  // Due by time at other shares: life 30 x share, rounded, is the day it comes due.
  it.each([
    { share: 0.33, notYet: 9, due: 10 }, // 9.9 rounds to 10
    { share: 0.5, notYet: 14, due: 15 },
    { share: 1, notYet: 29, due: 30 }, // 100%: only when its whole life has passed
  ])('share $share: not due on day $notYet, due on day $due', ({ share, notYet, due }) => {
    const at = (day: number) =>
      shareItem({ reorder: { kind: 'share', share }, startedOn: daysAgo(day) })
    expect(dueByTime(at(notYet), TODAY)).toBe(false)
    expect(dueByTime(at(due), TODAY)).toBe(true)
  })

  // Whole-number edge cases for quantity, reorder at 1. Validation reports 2.5, -1 and NaN; status
  // still answers. NaN fails every comparison, so it is never out or due (prototype behaviour).
  it.each([
    { quantity: 0, expected: 'out' },
    { quantity: 1, expected: 'due' },
    { quantity: 2.5, expected: 'ok' },
    { quantity: -1, expected: 'out' },
    { quantity: Number.NaN, expected: 'ok' },
  ] satisfies Array<{ quantity: number; expected: Status }>)(
    'quantity $quantity is $expected',
    ({ quantity, expected }) => {
      expect(status(makeItem({ quantity }), TODAY)).toBe(expected)
    },
  )

  it('throws on a corrupt start date instead of hiding it', () => {
    expect(() => status(shareItem({ startedOn: '2026-02-30' }), TODAY)).toThrow(InvalidDateError)
  })

  // Daylight saving changes between the start date and today (US 8 March, EU 29 March,
  // EU 25 October, US 1 November 2026). Life 30 x 0.9 = due on day 27.
  it.each([
    { today: '2026-03-09', started: '2026-02-11', due: false }, // day 26
    { today: '2026-03-09', started: '2026-02-10', due: true }, // day 27
    { today: '2026-03-30', started: '2026-03-04', due: false },
    { today: '2026-03-30', started: '2026-03-03', due: true },
    { today: '2026-11-02', started: '2026-10-07', due: false },
    { today: '2026-11-02', started: '2026-10-06', due: true },
  ])(
    'across a clock change: today $today, started $started, due $due',
    ({ today, started, due }) => {
      expect(dueByTime(shareItem({ startedOn: started }), today)).toBe(due)
    },
  )

  it.each([
    { today: '2026-10-31', expiresOn: '2026-10-30', expected: 'expired' },
    { today: '2026-10-31', expiresOn: '2026-11-01', expected: 'near-expiry' },
    { today: '2026-03-08', expiresOn: '2026-03-07', expected: 'expired' },
    { today: '2026-03-08', expiresOn: '2026-05-07', expected: 'near-expiry' }, // day 60
    { today: '2026-03-08', expiresOn: '2026-05-08', expected: 'ok' }, // day 61
  ] satisfies Array<{ today: string; expiresOn: string; expected: Status }>)(
    'expiry across a clock change: today $today, expires $expiresOn is $expected',
    ({ today, expiresOn, expected }) => {
      expect(status(makeItem({ expiresOn }), today)).toBe(expected)
    },
  )
})

describe('stockLeft', () => {
  it('uses the share left of the one in use when timing can be worked out', () => {
    expect(stockLeft(shareItem({ startedOn: daysAgo(0) }), TODAY)).toBe(1)
    expect(stockLeft(shareItem({ startedOn: daysAgo(15) }), TODAY)).toBe(0.5)
    expect(stockLeft(shareItem({ startedOn: daysAgo(27), quantity: 3 }), TODAY)).toBeCloseTo(0.1)
  })

  it('is 0, not negative, once the one in use is past its estimated life', () => {
    expect(stockLeft(shareItem({ startedOn: daysAgo(45) }), TODAY)).toBe(0)
  })

  it('uses quantity over buyUpTo when there is no timing', () => {
    expect(stockLeft(makeItem({ quantity: 3, buyUpTo: 4 }), TODAY)).toBe(0.75)
    expect(stockLeft(makeItem({ quantity: 0, buyUpTo: 4 }), TODAY)).toBe(0)
  })

  it('targets one more than the count rule when that is larger than buyUpTo', () => {
    const item = makeItem({ quantity: 2, buyUpTo: 1, reorder: { kind: 'count', atOrBelow: 3 } })
    expect(stockLeft(item, TODAY)).toBe(0.5)
  })

  it('counts a share rule as 0, so the target is at least 1', () => {
    const item = makeItem({ quantity: 1, buyUpTo: 0, reorder: { kind: 'share', share: 0.9 } })
    expect(stockLeft(item, TODAY)).toBe(1)
  })

  it('never goes above 1 when more are in stock than the target', () => {
    expect(stockLeft(makeItem({ quantity: 9, buyUpTo: 3 }), TODAY)).toBe(1)
  })

  it('falls back to quantity over target without a start date or lifetime', () => {
    expect(stockLeft(shareItem({ startedOn: undefined, quantity: 1, buyUpTo: 2 }), TODAY)).toBe(0.5)
    expect(stockLeft(shareItem({ lifeDays: undefined, quantity: 1, buyUpTo: 2 }), TODAY)).toBe(0.5)
  })
})

describe('stockTarget', () => {
  it('is buyUpTo when that is larger than the count rule', () => {
    expect(stockTarget(makeItem({ buyUpTo: 4, reorder: { kind: 'count', atOrBelow: 1 } }))).toBe(4)
  })

  it('is one more than the count rule when that is larger', () => {
    expect(stockTarget(makeItem({ buyUpTo: 1, reorder: { kind: 'count', atOrBelow: 3 } }))).toBe(4)
  })

  it('counts a share rule as 0, so it is at least 1', () => {
    expect(stockTarget(makeItem({ buyUpTo: 0, reorder: { kind: 'share', share: 0.9 } }))).toBe(1)
  })
})

describe('buyCount', () => {
  it('tops up to the target', () => {
    expect(buyCount(makeItem({ quantity: 1, buyUpTo: 4 }))).toBe(3)
    expect(buyCount(makeItem({ quantity: 0, buyUpTo: 2 }))).toBe(2)
  })

  it('is at least 1, even at or above the target', () => {
    expect(buyCount(makeItem({ quantity: 3, buyUpTo: 3 }))).toBe(1)
    expect(buyCount(makeItem({ quantity: 9, buyUpTo: 3 }))).toBe(1)
  })

  it('uses the count rule when it sets a higher target than buyUpTo', () => {
    const item = makeItem({ quantity: 2, buyUpTo: 1, reorder: { kind: 'count', atOrBelow: 4 } })
    expect(buyCount(item)).toBe(3)
  })
})
