import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CATEGORIES,
  CURRENT_SCHEMA_VERSION,
  KNOWN_UNITS,
  type Category,
  type IsoDate,
  type Item,
  type ReorderRule,
  type Unit,
} from './item'

// Invented example data, not anyone's real inventory.
const soap = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'test-item-1',
  name: 'Lavender Hand Soap',
  brand: 'Meadow & Co',
  category: 'hair',
  group: 'Hand Soap',
  location: 'Bathroom shelf',
  quantity: 2,
  unit: 'bottle',
  size: '300 ml',
  lifeDays: 45,
  startedOn: '2026-10-01',
  reorder: { kind: 'share', share: 0.9 },
  buyUpTo: 2,
  notes: '',
  links: { product: 'https://example.com/lavender-soap' },
  isExample: false,
} satisfies Item

// A minimal item: everything optional left out.
const sponges = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'test-item-2',
  name: 'Kitchen Sponges',
  brand: '',
  category: 'kitchen',
  group: 'Dishwashing',
  location: '',
  quantity: 0,
  unit: 'my own unit',
  size: '',
  reorder: { kind: 'count', atOrBelow: 1 },
  buyUpTo: 4,
  notes: '',
  links: {},
  isExample: true,
} satisfies Item

describe('Item type', () => {
  it('accepts full and minimal invented items', () => {
    expect(soap.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(sponges.links).toEqual({})
  })

  it('types the important fields', () => {
    expectTypeOf<Item['id']>().toEqualTypeOf<string>()
    expectTypeOf<Item['schemaVersion']>().toEqualTypeOf<number>()
    expectTypeOf<Item['category']>().toEqualTypeOf<Category>()
    expectTypeOf<Item['unit']>().toEqualTypeOf<Unit>()
    expectTypeOf<Item['reorder']>().toEqualTypeOf<ReorderRule>()
    // Optional fields may be missing, so their type includes undefined.
    expectTypeOf<Item['startedOn']>().toEqualTypeOf<IsoDate | undefined>()
    expectTypeOf<Item['expiresOn']>().toEqualTypeOf<IsoDate | undefined>()
    expectTypeOf<Item['lifeDays']>().toEqualTypeOf<number | undefined>()
  })

  it('rejects values the prototype never stores', () => {
    // @ts-expect-error: 'garden' is not one of the 10 categories
    expectTypeOf<'garden'>().toExtend<Category>()
    // @ts-expect-error: dates are "YYYY-MM-DD" strings, not Date objects
    expectTypeOf<Date>().toExtend<Item['startedOn']>()
    // @ts-expect-error: a share reorder only allows 0.25, 0.5, 0.75 or 0.9
    expectTypeOf<{ kind: 'share'; share: 0.3 }>().toExtend<ReorderRule>()
  })

  it('lists the prototype categories and units', () => {
    expect(CATEGORIES).toHaveLength(10)
    expect(KNOWN_UNITS).toHaveLength(34)
    expect(new Set(KNOWN_UNITS).size).toBe(KNOWN_UNITS.length)
  })
})
