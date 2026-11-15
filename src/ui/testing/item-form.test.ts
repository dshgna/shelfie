// The item editor's rules (src/ui/item-form.ts). Invented data only.

import { describe, expect, it } from 'vitest'
import { plusDays } from '../../domain/dates'
import { CURRENT_SCHEMA_VERSION, DEFAULT_GROUPS, type Item } from '../../domain/item'
import { DEFAULT_SHARE } from '../../domain/status'
import { calcStock } from '../../domain/stock'
import { TODAY, makeItem } from '../../domain/testing/helpers/fixtures'
import { guessDays } from '../../domain/typical'
import {
  buildEdit,
  buildNew,
  firstGroup,
  groupOptions,
  newValues,
  typicalDays,
  valuesFromItem,
  type FormValues,
} from '../item-form'

const IDS = { itemId: 'new-item', purchaseId: 'new-purchase' }

function addValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    ...newValues('kitchen'),
    name: 'Lemon Dish Soap',
    brand: 'Exampleside',
    size: '500 ml',
    count: '2',
    ...overrides,
  }
}

function okEdit(item: Item, values: FormValues) {
  const result = buildEdit(item, values, TODAY)
  if (!result.ok) throw new Error(`expected a valid edit: ${JSON.stringify(result.errors)}`)
  return result.item
}

function okNew(values: FormValues) {
  const result = buildNew(values, IDS, 'home', TODAY)
  if (!result.ok) throw new Error(`expected a valid new item: ${JSON.stringify(result.errors)}`)
  return result
}

describe('groupOptions', () => {
  it("lists the category's default groups, then Other", () => {
    expect(groupOptions('laundry')).toEqual([...DEFAULT_GROUPS.laundry, 'Other'])
  })

  it("adds the item's own group when it isn't a default one", () => {
    expect(groupOptions('laundry', 'Delicates')).toEqual([
      ...DEFAULT_GROUPS.laundry,
      'Other',
      'Delicates',
    ])
  })

  it('never lists a group twice', () => {
    expect(groupOptions('laundry', 'Washing')).toEqual([...DEFAULT_GROUPS.laundry, 'Other'])
    expect(groupOptions('laundry', 'Other')).toEqual([...DEFAULT_GROUPS.laundry, 'Other'])
  })

  it('firstGroup is the first default group', () => {
    expect(firstGroup('kitchen')).toBe(DEFAULT_GROUPS.kitchen[0])
  })
})

describe('form values', () => {
  it('starts a new item on the kitchen shelf, buying one today', () => {
    expect(newValues()).toEqual({
      name: '',
      brand: '',
      size: '',
      count: '1',
      bought: '',
      category: 'kitchen',
      group: DEFAULT_GROUPS.kitchen[0],
      days: '',
    })
  })

  it('fills in from an item, with blank days when it has no lifetime', () => {
    const item = makeItem({ quantity: 4 })
    expect(valuesFromItem(item)).toMatchObject({
      name: item.name,
      brand: item.brand,
      size: item.size,
      count: '4',
      bought: '',
      category: item.category,
      group: item.group,
      days: '',
    })
    expect(valuesFromItem(makeItem({ lifeDays: 45 })).days).toBe('45')
  })

  it("typicalDays is the domain's guess for what is typed", () => {
    const values = addValues()
    expect(typicalDays(values)).toBe(guessDays('Lemon Dish Soap', '500 ml', 'bottle', 'kitchen'))
  })
})

describe('buildEdit', () => {
  it('saves the typed fields, trimmed, and keeps the rest of the item', () => {
    const item = makeItem({ id: 'soap', householdId: 'home', link: 'https://shop.example/soap' })
    const saved = okEdit(item, {
      ...valuesFromItem(item),
      name: '  Lemon Soap  ',
      brand: ' Exampleside ',
      size: ' 250 ml ',
      count: '5',
      category: 'kitchen',
      group: 'Hand Soap',
    })
    expect(saved).toMatchObject({
      id: 'soap',
      householdId: 'home',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Lemon Soap',
      brand: 'Exampleside',
      size: '250 ml',
      quantity: 5,
      category: 'kitchen',
      group: 'Hand Soap',
      link: 'https://shop.example/soap',
    })
    expect('updatedAt' in saved).toBe(false)
  })

  it('reports a missing name next to the name field', () => {
    const result = buildEdit(makeItem(), { ...valuesFromItem(makeItem()), name: '   ' }, TODAY)
    expect(result).toEqual({
      ok: false,
      errors: { fields: { name: 'Enter a name for the item.' }, other: [] },
    })
  })

  it.each(['', '2.5', '-1', 'two'])('reports an in-stock count of "%s"', (count) => {
    const result = buildEdit(makeItem(), { ...valuesFromItem(makeItem()), count }, TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.fields.count).toBe('This must be a whole number, 0 or more.')
    }
  })

  it('accepts 0 in stock', () => {
    expect(okEdit(makeItem(), { ...valuesFromItem(makeItem()), count: '0' }).quantity).toBe(0)
  })

  it('reports days that are not a whole number', () => {
    const result = buildEdit(makeItem(), { ...valuesFromItem(makeItem()), days: '1.5' }, TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors.fields.days).toBe('This must be a whole number, 0 or more.')
  })

  it('leaves the lifetime unset for blank days on an item that reorders by count', () => {
    const item = makeItem({ lifeDays: 30, reorder: { kind: 'count', atOrBelow: 1 } })
    const saved = okEdit(item, { ...valuesFromItem(item), days: '' })
    expect('lifeDays' in saved).toBe(false)
  })

  it('uses the typical estimate for blank days on an item that reorders by share', () => {
    const item = makeItem({ quantity: 1, reorder: { kind: 'share', share: 0.9 }, lifeDays: 40 })
    const saved = okEdit(item, { ...valuesFromItem(item), days: '' })
    expect(saved.lifeDays).toBe(guessDays(item.name, item.size, item.unit, item.category))
  })

  it('starts the clock today when there is now a lifetime and stock but no start date', () => {
    const item = makeItem({ quantity: 2 })
    const saved = okEdit(item, { ...valuesFromItem(item), days: '30' })
    expect(saved).toMatchObject({ lifeDays: 30, startedOn: TODAY })
  })

  it('keeps an existing start date', () => {
    const started = plusDays(TODAY, -10)
    const item = makeItem({ quantity: 2, lifeDays: 30, startedOn: started })
    expect(okEdit(item, valuesFromItem(item)).startedOn).toBe(started)
  })

  it('clears the start date when none are left', () => {
    const item = makeItem({ quantity: 2, lifeDays: 30, startedOn: plusDays(TODAY, -10) })
    const saved = okEdit(item, { ...valuesFromItem(item), count: '0' })
    expect('startedOn' in saved).toBe(false)
  })

  it('never changes the item it is given', () => {
    const item = makeItem()
    const before = structuredClone(item)
    buildEdit(item, { ...valuesFromItem(item), name: 'Changed', count: '9' }, TODAY)
    expect(item).toEqual(before)
  })
})

describe('buildNew', () => {
  it('works out the stock with calcStock and builds the first purchase record', () => {
    const bought = plusDays(TODAY, -70)
    const result = okNew(addValues({ count: '3', bought, days: '30' }))
    const stock = calcStock(
      {
        quantity: 3,
        boughtAt: bought,
        size: '500 ml',
        unit: 'bottle',
        name: 'Lemon Dish Soap',
        category: 'kitchen',
        lifeDays: 30,
      },
      TODAY,
    )
    expect(stock.left).toBe(1)
    expect(result.item).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'new-item',
      householdId: 'home',
      name: 'Lemon Dish Soap',
      brand: 'Exampleside',
      category: 'kitchen',
      group: DEFAULT_GROUPS.kitchen[0],
      location: '',
      quantity: 1,
      unit: 'bottle',
      size: '500 ml',
      lifeDays: 30,
      startedOn: stock.startedOn,
      reorder: { kind: 'share', share: DEFAULT_SHARE },
      buyUpTo: 1,
      notes: '',
      isExample: false,
      deleted: false,
    })
    expect(result.purchase).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'new-purchase',
      itemId: 'new-item',
      quantity: 3,
      size: '500 ml',
      unit: 'bottle',
      boughtAt: bought,
    })
  })

  it('counts a blank bought date as today', () => {
    const result = okNew(addValues({ bought: '' }))
    expect(result.purchase.boughtAt).toBe(TODAY)
    expect(result.item.startedOn).toBe(TODAY)
    expect(result.item.quantity).toBe(2)
  })

  it('uses the typical estimate for blank days', () => {
    const result = okNew(addValues({ days: '' }))
    expect(result.item.lifeDays).toBe(guessDays('Lemon Dish Soap', '500 ml', 'bottle', 'kitchen'))
  })

  it('leaves out the start date when everything bought is used up', () => {
    const result = okNew(addValues({ count: '1', bought: plusDays(TODAY, -90), days: '30' }))
    expect(result.item.quantity).toBe(0)
    expect('startedOn' in result.item).toBe(false)
    expect(result.purchase.quantity).toBe(1)
  })

  it.each(['', '0', '1.5', '-2', 'many'])('reports a count of "%s"', (count) => {
    const result = buildNew(addValues({ count }), IDS, 'home', TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors.fields.count).toBe('This must be a whole number, 1 or more.')
  })

  it('reports a bought date that is not a real date', () => {
    const result = buildNew(addValues({ bought: '2026-02-30' }), IDS, 'home', TODAY)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.fields.bought).toBe(
        'This must be a real date written as YYYY-MM-DD, for example 2026-11-14.',
      )
    }
  })

  it('reports every problem at once, each next to its field', () => {
    const result = buildNew(addValues({ name: '', count: '0', days: '2.5' }), IDS, 'home', TODAY)
    expect(result).toEqual({
      ok: false,
      errors: {
        fields: {
          name: 'Enter a name for the item.',
          count: 'This must be a whole number, 1 or more.',
          days: 'This must be a whole number, 0 or more.',
        },
        other: [],
      },
    })
  })

  it('uses Other when no group is chosen', () => {
    expect(okNew(addValues({ group: '' })).item.group).toBe('Other')
  })
})
