import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './item'
import { HOME_CATEGORIES, TYPICAL, guessDays, typicalFor, type Typical } from './typical'

// Invented product names, not anyone's real purchases.

describe('TYPICAL', () => {
  it('has the prototype’s 26 rules, each with a positive fallback', () => {
    expect(TYPICAL).toHaveLength(26)
    for (const [, dailyUse, days] of TYPICAL) {
      expect(days).toBeGreaterThan(0)
      if (dailyUse !== null) expect(dailyUse).toBeGreaterThan(0)
    }
  })

  it('only names real categories as home categories', () => {
    for (const category of HOME_CATEGORIES) expect(CATEGORIES).toContain(category)
  })
})

describe('typicalFor', () => {
  it.each<{ name: string; size: string; expected: Typical | undefined }>([
    // Known product types, from size and daily use
    { name: 'Rosemary Shampoo', size: '250 ml', expected: { days: 50, fromSize: true } },
    { name: 'Vitamin C Serum', size: '30 ml', expected: { days: 60, fromSize: true } },
    { name: 'Body Lotion', size: '1 l', expected: { days: 200, fromSize: true } },
    { name: 'Lip Balm', size: '4 g', expected: { days: 80, fromSize: true } },
    { name: 'SHAMPOO', size: '250 ML', expected: { days: 50, fromSize: true } }, // any case
    // Never below 1 day
    { name: 'Eye Cream', size: '0.01 ml', expected: { days: 1, fromSize: true } },
    // Known type, but the size doesn't help
    { name: 'Shampoo', size: '', expected: { days: 50, fromSize: false } },
    { name: 'Shampoo', size: 'large', expected: { days: 50, fromSize: false } },
    { name: 'Shampoo', size: '0 ml', expected: { days: 50, fromSize: false } },
    { name: 'Bamboo Toothbrush', size: '1 piece', expected: { days: 90, fromSize: false } },
    // Unknown product types
    { name: 'Mystery Thing', size: '250 ml', expected: undefined },
    { name: '', size: '', expected: undefined },
  ])('"$name", "$size"', ({ name, size, expected }) => {
    expect(typicalFor(name, size)).toEqual(expected)
  })

  // Questionable rules, kept as in the prototype. These tests pin today's behaviour so a change
  // to TYPICAL is a deliberate decision.
  it.each([
    {
      case: 'fabric conditioner uses the hair conditioner rule',
      name: 'Fabric Conditioner',
      size: '1 l',
      days: 250,
    }, // 1000 / 4
    { case: 'dish soap uses the body wash rule', name: 'Dish Soap', size: '500 ml', days: 100 }, // 500 / 5
    { case: 'SPF lip balm uses the sun cream rule', name: 'SPF Lip Balm', size: '4 g', days: 3 }, // 4 / 1.25
    {
      case: 'shaving foam uses the face cleanser rule',
      name: 'Shaving Foam',
      size: '200 ml',
      days: 100,
    }, // 200 / 2
    {
      case: 'body moisturiser uses the face moisturiser rule',
      name: 'Body Moisturiser',
      size: '400 ml',
      days: 571,
    }, // 400 / 0.7
    { case: 'a bare number counts as ml', name: 'Shampoo', size: '10 pieces', days: 2 }, // 10 / 5
    { case: 'only the first number is read', name: 'Hydrating Toner', size: '2 x 150 ml', days: 1 }, // 2 / 2
  ])('oddity: $case', ({ name, size, days }) => {
    expect(typicalFor(name, size)?.days).toBe(days)
  })
})

describe('guessDays', () => {
  it.each([
    // From size and typical daily use
    { name: 'Rosemary Shampoo', size: '250 ml', expected: 50 }, // 250 / 5
    { name: 'Vitamin C Serum', size: '30 ml', expected: 60 }, // 30 / 0.5
    { name: 'Face SPF 50', size: '50 ml', expected: 40 }, // 50 / 1.25
    { name: 'Body Lotion', size: '1 l', expected: 200 }, // 1000 / 5
    { name: 'Shampoo', size: '1,5 l', expected: 300 }, // comma as decimal point
    { name: 'Shampoo', size: '8.5 fl oz', expected: 50 }, // 251.3 ml / 5, rounded
    { name: 'Lip Balm', size: '4 g', expected: 80 }, // 4 / 0.05
    // Rule's fallback days
    { name: 'Shampoo', size: '', expected: 50 },
    { name: 'Toothpaste', size: '0 ml', expected: 50 },
    { name: 'Waterproof Mascara', size: '10 ml', expected: 90 }, // no daily amount
    // Oddities kept
    { name: 'Hydrating Toner', size: '2 x 150 ml', expected: 1 }, // first number only: 2 / 2
    { name: 'Fabric Conditioner', size: '1 l', expected: 250 }, // matches hair conditioner: 1000 / 4
  ])('$name, "$size": $expected days', ({ name, size, expected }) => {
    expect(guessDays(name, size, 'bottle', 'beauty')).toBe(expected)
  })

  it.each([
    { unit: 'tube', category: 'beauty', expected: 45 },
    { unit: 'bar', category: 'hair', expected: 30 },
    { unit: 'bottle', category: 'kitchen', expected: 90 },
    { unit: 'bottle', category: 'health', expected: 90 },
    { unit: 'bottle', category: 'beauty', expected: 60 },
    { unit: 'pack', category: 'kitchen', expected: 60 },
    { unit: 'my own unit', category: 'skincare', expected: 60 },
  ] as const)(
    'unknown product type: $unit in $category is $expected days',
    ({ unit, category, expected }) => {
      expect(guessDays('Mystery Thing', '', unit, category)).toBe(expected)
    },
  )
})

describe('size units added in the test review', () => {
  it.each([
    { size: '1.2 kg', days: 240 }, // 1200 g / 5
    { size: '3 oz', days: 18 }, // 88.7 / 5, rounded
  ])('shampoo, "$size": $days days', ({ size, days }) => {
    expect(typicalFor('Shampoo', size)).toEqual({ days, fromSize: true })
  })
})
