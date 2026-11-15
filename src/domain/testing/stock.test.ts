import { describe, expect, it } from 'vitest'
import { InvalidDateError, plusDays } from '../dates'
import type { Item } from '../item'
import { status, type Status } from '../status'
import { calcStock, type Purchase, type StockEstimate } from '../stock'
import { TODAY, makeItem, makePurchase } from './helpers/fixtures'

// Invented example data. makePurchase's default: 3 bottles of shampoo, 30 days each, bought
// on TODAY. All dates are relative to TODAY.
const daysAgo = (n: number) => plusDays(TODAY, -n)
const inDays = (n: number) => plusDays(TODAY, n)

describe('calcStock', () => {
  it.each([
    {
      case: 'zero bought',
      purchase: makePurchase({ count: 0, boughtOn: daysAgo(10) }),
      expected: { lifeDays: 30, used: 0, left: 0 },
    },
    {
      case: 'bought today',
      purchase: makePurchase(),
      expected: { lifeDays: 30, used: 0, left: 3, startedOn: TODAY },
    },
    {
      case: 'no purchase date (counts as today)',
      purchase: makePurchase({ boughtOn: undefined }),
      expected: { lifeDays: 30, used: 0, left: 3, startedOn: TODAY },
    },
    // On the boundary the first one is used up and the next starts that day.
    {
      case: 'a day before one lifetime',
      purchase: makePurchase({ boughtOn: daysAgo(29) }),
      expected: { lifeDays: 30, used: 0, left: 3, startedOn: daysAgo(29) },
    },
    {
      case: 'exactly one lifetime',
      purchase: makePurchase({ boughtOn: daysAgo(30) }),
      expected: { lifeDays: 30, used: 1, left: 2, startedOn: TODAY },
    },
    {
      case: 'a day after one lifetime',
      purchase: makePurchase({ boughtOn: daysAgo(31) }),
      expected: { lifeDays: 30, used: 1, left: 2, startedOn: daysAgo(1) },
    },
    {
      case: 'exactly all lifetimes',
      purchase: makePurchase({ boughtOn: daysAgo(90) }),
      expected: { lifeDays: 30, used: 3, left: 0 },
    },
    {
      case: 'many lifetimes (clamped at 0 left)',
      purchase: makePurchase({ boughtOn: daysAgo(400) }),
      expected: { lifeDays: 30, used: 3, left: 0 },
    },
    {
      case: 'a multipack counted per item (pack of 3 bought twice)',
      purchase: makePurchase({ count: 6, boughtOn: daysAgo(45) }),
      expected: { lifeDays: 30, used: 1, left: 5, startedOn: daysAgo(15) },
    },
    // Oddity kept: a future purchase date counts as 0 days, but the start date stays in the future.
    {
      case: 'a purchase date in the future',
      purchase: makePurchase({ boughtOn: inDays(10) }),
      expected: { lifeDays: 30, used: 0, left: 3, startedOn: inDays(10) },
    },
    // No lifetime: guessed. 250 ml of shampoo at 5 ml a day is 50 days.
    {
      case: 'no lifetime (guessed)',
      purchase: makePurchase({ lifeDays: undefined, boughtOn: daysAgo(60) }),
      expected: { lifeDays: 50, used: 1, left: 2, startedOn: daysAgo(10) },
    },
    {
      case: 'a lifetime of 0 (guessed)',
      purchase: makePurchase({ lifeDays: 0, boughtOn: daysAgo(60) }),
      expected: { lifeDays: 50, used: 1, left: 2, startedOn: daysAgo(10) },
    },
    // 30.5 days: one used up after 31 days, and the start date drops the half day, as in the prototype.
    {
      case: 'a fractional lifetime',
      purchase: makePurchase({ lifeDays: 30.5, boughtOn: daysAgo(31) }),
      expected: { lifeDays: 30.5, used: 1, left: 2, startedOn: daysAgo(1) },
    },
  ] satisfies Array<{ case: string; purchase: Purchase; expected: StockEstimate }>)(
    '$case',
    ({ purchase, expected }) => {
      expect(calcStock(purchase, TODAY)).toEqual(expected)
    },
  )

  it('leaves startedOn out when nothing is left', () => {
    expect('startedOn' in calcStock(makePurchase({ boughtOn: daysAgo(400) }), TODAY)).toBe(false)
  })

  it.each([
    { case: 'a fraction', count: 1.5 },
    { case: 'a negative count', count: -1 },
    { case: 'NaN', count: Number.NaN },
  ])('throws a RangeError for $case', ({ count }) => {
    expect(() => calcStock(makePurchase({ count }), TODAY)).toThrow(RangeError)
  })

  it('throws InvalidDateError for an impossible purchase date', () => {
    expect(() => calcStock(makePurchase({ boughtOn: '2026-02-30' }), TODAY)).toThrow(
      InvalidDateError,
    )
  })
})

describe('calcStock and status agree', () => {
  /**
   * What the prototype's importer does with a new purchase, written out here only for the test
   * (the real conversion belongs to the importer item): quantity from left, start from startedOn,
   * lifetime from lifeDays, reorder when 10% of the open one is left.
   */
  function itemFrom(estimate: StockEstimate): Item {
    return makeItem({
      quantity: estimate.left,
      lifeDays: estimate.lifeDays,
      startedOn: estimate.startedOn,
      reorder: { kind: 'share', share: 0.9 },
    })
  }

  // 2 bought, 30 days each. The second one starts 30 days after purchase, and 30 x 0.9 = 27 days
  // later it is due: so 57 days after purchase.
  it.each([
    { case: 'a day before the 10% threshold', count: 2, boughtDaysAgo: 56, expected: 'ok' },
    { case: 'exactly at the 10% threshold', count: 2, boughtDaysAgo: 57, expected: 'due' },
    { case: 'a day after the 10% threshold', count: 2, boughtDaysAgo: 58, expected: 'due' },
    { case: 'all used up', count: 2, boughtDaysAgo: 60, expected: 'out' },
    // Only the last one is ever due by time: with 2 left, the open one's age doesn't matter.
    { case: 'at the threshold with a spare left', count: 3, boughtDaysAgo: 57, expected: 'ok' },
  ] satisfies Array<{ case: string; count: number; boughtDaysAgo: number; expected: Status }>)(
    '$case: $expected',
    ({ count, boughtDaysAgo, expected }) => {
      const estimate = calcStock(makePurchase({ count, boughtOn: daysAgo(boughtDaysAgo) }), TODAY)
      expect(status(itemFrom(estimate), TODAY)).toBe(expected)
    },
  )
})

describe('boundaries added in the test review', () => {
  it.each([
    { boughtDaysAgo: 29, expected: { lifeDays: 30, used: 0, left: 1, startedOn: daysAgo(29) } },
    { boughtDaysAgo: 30, expected: { lifeDays: 30, used: 1, left: 0 } },
  ] satisfies Array<{ boughtDaysAgo: number; expected: StockEstimate }>)(
    'one bought, $boughtDaysAgo days ago',
    ({ boughtDaysAgo, expected }) => {
      expect(
        calcStock(makePurchase({ count: 1, boughtOn: daysAgo(boughtDaysAgo) }), TODAY),
      ).toEqual(expected)
    },
  )

  // Not a usable lifetime, so it is guessed: 250 ml of shampoo at 5 ml a day is 50 days.
  it.each([{ lifeDays: Number.NaN }, { lifeDays: -5 }])(
    'a lifetime of $lifeDays is guessed',
    ({ lifeDays }) => {
      expect(calcStock(makePurchase({ lifeDays }), TODAY).lifeDays).toBe(50)
    },
  )

  // 30 days that include a clock change still count as exactly 30.
  it.each([
    { today: '2026-03-31', boughtOn: '2026-03-01' },
    { today: '2026-11-02', boughtOn: '2026-10-03' },
  ])('across a clock change: bought $boughtOn, today $today', ({ today, boughtOn }) => {
    expect(calcStock(makePurchase({ boughtOn }), today)).toEqual({
      lifeDays: 30,
      used: 1,
      left: 2,
      startedOn: today,
    })
  })

  it('throws InvalidDateError for an invalid today', () => {
    expect(() => calcStock(makePurchase(), '2026-1-5')).toThrow(InvalidDateError)
  })
})
