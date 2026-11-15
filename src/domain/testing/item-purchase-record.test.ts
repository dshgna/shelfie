import { describe, expect, expectTypeOf, it } from 'vitest'
import { isValidIsoDateTime, type IsoDateTime } from '../dates'
import { CURRENT_SCHEMA_VERSION, type Item } from '../item'
import type { ItemRecord } from '../item-record'
import { validateItem } from '../validate'
import { makeItemRecord } from './helpers/fixtures'

// Invented example data.
const record = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'record-1',
  name: 'Lavender Hand Soap',
  brand: 'Example & Co',
  category: 'hair',
  group: 'Hand Soap',
  location: 'Bathroom shelf',
  quantity: 2,
  unit: 'bottle',
  size: '300 ml',
  reorder: { kind: 'count', atOrBelow: 1 },
  buyUpTo: 2,
  notes: '',
  links: {},
  isExample: false,
  householdId: 'household-1',
  createdAt: '2026-11-15T09:30:00.000Z',
  updatedAt: '2026-11-15T10:05:00.000Z',
  deleted: false,
} satisfies ItemRecord

describe('ItemRecord type', () => {
  it('accepts an invented record', () => {
    expect(record.updatedAt > record.createdAt).toBe(true)
  })

  it('is an Item plus the storage fields', () => {
    expectTypeOf<ItemRecord>().toExtend<Item>()
    expectTypeOf<ItemRecord['householdId']>().toEqualTypeOf<string>()
    expectTypeOf<ItemRecord['createdAt']>().toEqualTypeOf<IsoDateTime>()
    expectTypeOf<ItemRecord['updatedAt']>().toEqualTypeOf<IsoDateTime>()
    expectTypeOf<ItemRecord['deleted']>().toEqualTypeOf<boolean>()
    expectTypeOf<ItemRecord['schemaVersion']>().toEqualTypeOf<Item['schemaVersion']>()
  })

  it('rejects an Item without the storage fields', () => {
    // @ts-expect-error: a plain Item has no householdId, timestamps or deleted flag
    expectTypeOf<Item>().toExtend<ItemRecord>()
  })

  it('has a valid fixture that validateItem accepts as an Item', () => {
    const fixture = makeItemRecord()
    expect(validateItem(fixture)).toEqual([])
    expect(isValidIsoDateTime(fixture.createdAt)).toBe(true)
    expect(isValidIsoDateTime(fixture.updatedAt)).toBe(true)
    expect(fixture.deleted).toBe(false)
  })
})
