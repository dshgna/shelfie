import { describe, expect, expectTypeOf, it } from 'vitest'
import { isValidIsoDate, isValidIsoDateTime, type IsoDate, type IsoDateTime } from '../dates'
import { CURRENT_SCHEMA_VERSION, type Unit } from '../item'
import { isValidRecordQuantity, type ItemPurchaseRecord } from '../item-purchase-record'
import { makeItemPurchaseRecord } from './helpers/fixtures'

// Invented example data.
const record = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'record-1',
  itemId: 'item-1',
  quantity: 3,
  size: '300 ml',
  unit: 'bottle',
  boughtAt: '2026-11-15',
  addedAt: '2026-11-15T09:30:00.000Z',
  updatedAt: '2026-11-15T10:05:00.000Z',
} satisfies ItemPurchaseRecord

describe('ItemPurchaseRecord type', () => {
  it('accepts an invented record', () => {
    expect(record.itemId).toBe('item-1')
  })

  it('types the important fields', () => {
    expectTypeOf<ItemPurchaseRecord['schemaVersion']>().toEqualTypeOf<number>()
    expectTypeOf<ItemPurchaseRecord['id']>().toEqualTypeOf<string>()
    expectTypeOf<ItemPurchaseRecord['itemId']>().toEqualTypeOf<string>()
    expectTypeOf<ItemPurchaseRecord['quantity']>().toEqualTypeOf<number>()
    expectTypeOf<ItemPurchaseRecord['size']>().toEqualTypeOf<string>()
    expectTypeOf<ItemPurchaseRecord['unit']>().toEqualTypeOf<Unit>()
    // Left out when no expiry date was given, so it may be missing.
    expectTypeOf<ItemPurchaseRecord['expiresOn']>().toEqualTypeOf<IsoDate | undefined>()
    expectTypeOf<ItemPurchaseRecord['boughtAt']>().toEqualTypeOf<IsoDate>()
    expectTypeOf<ItemPurchaseRecord['addedAt']>().toEqualTypeOf<IsoDateTime>()
    expectTypeOf<ItemPurchaseRecord['updatedAt']>().toEqualTypeOf<IsoDateTime>()
  })

  it('has no deleted field: people cannot delete a record', () => {
    type Has<K extends string> = K extends keyof ItemPurchaseRecord ? true : false
    expectTypeOf<Has<'deleted'>>().toEqualTypeOf<false>()
  })

  it('rejects values it never stores', () => {
    // @ts-expect-error: boughtAt is text, not a Date
    expectTypeOf<Date>().toExtend<ItemPurchaseRecord['boughtAt']>()
    // @ts-expect-error: addedAt is text, not a Date
    expectTypeOf<Date>().toExtend<ItemPurchaseRecord['addedAt']>()
  })

  it('has a valid fixture', () => {
    const fixture = makeItemPurchaseRecord()
    expect(fixture.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(isValidRecordQuantity(fixture.quantity)).toBe(true)
    expect(isValidIsoDate(fixture.boughtAt)).toBe(true)
    expect(isValidIsoDateTime(fixture.addedAt)).toBe(true)
    expect(isValidIsoDateTime(fixture.updatedAt)).toBe(true)
  })
})

describe('isValidRecordQuantity', () => {
  it.each([
    { quantity: 1, valid: true },
    { quantity: 2, valid: true },
    { quantity: 99, valid: true },
    { quantity: 0, valid: false }, // a purchase of 0 isn't a purchase
    { quantity: -1, valid: false },
    { quantity: 1.5, valid: false },
    { quantity: Number.NaN, valid: false },
    { quantity: Number.POSITIVE_INFINITY, valid: false },
  ])('$quantity is valid: $valid', ({ quantity, valid }) => {
    expect(isValidRecordQuantity(quantity)).toBe(valid)
  })
})
