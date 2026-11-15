import { describe, expect, it } from 'vitest'
import { plusDays } from '../dates'
import { DEFAULT_GROUPS } from '../item'
import { ROUTINE_STEPS, coversStep, routineFor } from '../routine'
import { TODAY, makeItem } from './helpers/fixtures'

// Invented skincare items. makeItem: 3 in stock, reorder at 1, no expiry, so status 'ok'.
const skincare = (overrides: Parameters<typeof makeItem>[0] = {}) =>
  makeItem({ category: 'skincare', group: 'Step 3 · Toner', name: 'Rice Toner', ...overrides })

describe('ROUTINE_STEPS', () => {
  it('lists the seven steps in order', () => {
    expect(ROUTINE_STEPS).toEqual([
      'Step 1 · Oil Cleanser',
      'Step 2 · Water Cleanser',
      'Step 3 · Toner',
      'Step 4 · Essence',
      'Step 5 · Serum or Ampoule',
      'Step 6 · Moisturiser',
      'Step 7 · Sun Protection',
    ])
  })

  it("are skincare's default groups, in the same order, without the extras", () => {
    expect(DEFAULT_GROUPS.skincare.filter((group) => ROUTINE_STEPS.includes(group))).toEqual(
      ROUTINE_STEPS,
    )
    expect(ROUTINE_STEPS).not.toContain('Eye Cream')
  })
})

describe('coversStep', () => {
  it.each([
    { case: 'in stock', item: skincare(), covers: true },
    { case: 'expiring soon', item: skincare({ expiresOn: plusDays(TODAY, 5) }), covers: true },
    { case: 'expiring today', item: skincare({ expiresOn: TODAY }), covers: true },
    { case: 'low', item: skincare({ quantity: 1 }), covers: true },
    { case: 'out of stock', item: skincare({ quantity: 0 }), covers: false },
    { case: 'expired', item: skincare({ expiresOn: plusDays(TODAY, -1) }), covers: false },
  ])('$case: $covers', ({ item, covers }) => {
    expect(coversStep(item, TODAY)).toBe(covers)
  })
})

describe('routineFor', () => {
  it('puts each skincare item on its step, keeping the order given', () => {
    const b = skincare({ id: 'b', name: 'B' })
    const a = skincare({ id: 'a', name: 'A' })
    const oil = skincare({ id: 'oil', group: 'Step 1 · Oil Cleanser' })
    const routine = routineFor([b, oil, a], TODAY)
    expect(routine.steps.map((step) => [step.group, step.items.map((item) => item.id)])).toEqual([
      ['Step 1 · Oil Cleanser', ['oil']],
      ['Step 2 · Water Cleanser', []],
      ['Step 3 · Toner', ['b', 'a']],
      ['Step 4 · Essence', []],
      ['Step 5 · Serum or Ampoule', []],
      ['Step 6 · Moisturiser', []],
      ['Step 7 · Sun Protection', []],
    ])
  })

  it('counts a step as covered when one of its items covers it', () => {
    const routine = routineFor(
      [
        skincare({ id: 'out', quantity: 0 }),
        skincare({ id: 'ok' }),
        skincare({ id: 'expired', group: 'Step 4 · Essence', expiresOn: plusDays(TODAY, -3) }),
        skincare({ id: 'spf', group: 'Step 7 · Sun Protection', quantity: 1 }),
      ],
      TODAY,
    )
    expect(routine.steps.map((step) => step.covered)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      true,
    ])
    expect(routine.covered).toBe(2)
  })

  it('lists skincare items on no step as extras', () => {
    const eye = skincare({ id: 'eye', group: 'Eye Cream' })
    const mask = skincare({ id: 'mask', group: 'Masks' })
    const routine = routineFor([eye, skincare({ id: 'toner' }), mask], TODAY)
    expect(routine.extras.map((item) => item.id)).toEqual(['eye', 'mask'])
  })

  it('ignores other categories and deleted items', () => {
    const routine = routineFor(
      [
        makeItem({ id: 'paste', category: 'dental', group: 'Step 3 · Toner' }),
        skincare({ id: 'gone', deleted: true }),
      ],
      TODAY,
    )
    expect(routine.steps.every((step) => step.items.length === 0)).toBe(true)
    expect(routine.extras).toEqual([])
    expect(routine.covered).toBe(0)
  })

  it('has all seven steps, none covered, with no items', () => {
    const routine = routineFor([], TODAY)
    expect(routine.steps).toHaveLength(7)
    expect(routine.covered).toBe(0)
  })
})
