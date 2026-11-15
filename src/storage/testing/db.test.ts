import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Item } from '../../domain/item'
import {
  makeHousehold,
  makeItem,
  makeItemPurchaseRecord,
  makeUser,
} from '../../domain/testing/helpers/fixtures'
import { STORES_V1, openDb, type ShelfieDB } from '../db'

// Each test gets its own database, deleted afterwards, so no test sees another's rows.
let dbCount = 0
let db: ShelfieDB

beforeEach(() => {
  dbCount += 1
  db = openDb(`db-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

describe('ShelfieDB', () => {
  it('creates the four tables when opened', async () => {
    await db.open()
    const storeNames = Array.from(db.backendDB().objectStoreNames).sort()
    expect(storeNames).toEqual(['households', 'itemPurchaseRecords', 'items', 'users'])
  })

  it('puts and gets a user', async () => {
    const user = makeUser()
    await db.users.put(user)
    expect(await db.users.get(user.id)).toEqual(user)
  })

  it('puts and gets a household', async () => {
    const household = makeHousehold()
    await db.households.put(household)
    expect(await db.households.get(household.id)).toEqual(household)
  })

  it('puts and gets an item', async () => {
    const item = makeItem()
    await db.items.put(item)
    expect(await db.items.get(item.id)).toEqual(item)
  })

  it('puts and gets an item record', async () => {
    const record = makeItemPurchaseRecord()
    await db.itemPurchaseRecords.put(record)
    expect(await db.itemPurchaseRecords.get(record.id)).toEqual(record)
  })
})

describe('item queries', () => {
  it('finds items by householdId', async () => {
    await db.items.bulkPut([
      makeItem({ id: 'a', householdId: 'home' }),
      makeItem({ id: 'b', householdId: 'cabin' }),
      makeItem({ id: 'c', householdId: 'home' }),
    ])
    const ids = await db.items.where('householdId').equals('home').primaryKeys()
    expect(ids.sort()).toEqual(['a', 'c'])
  })

  it('indexes items on householdId, [category+group] and updatedAt', () => {
    const indexes = db.items.schema.indexes.map((index) => index.name).sort()
    expect(indexes).toEqual(['[category+group]', 'householdId', 'updatedAt'])
  })

  it('lists items in updatedAt order', async () => {
    await db.items.bulkPut([
      makeItem({ id: 'middle', updatedAt: '2026-11-14T10:00:00.000Z' }),
      makeItem({ id: 'latest', updatedAt: '2026-11-14T11:00:00.000Z' }),
      makeItem({ id: 'earliest', updatedAt: '2026-11-14T09:00:00.000Z' }),
    ])
    const ids = await db.items.orderBy('updatedAt').primaryKeys()
    expect(ids).toEqual(['earliest', 'middle', 'latest'])
  })

  it('finds items by [category+group]', async () => {
    await db.items.bulkPut([
      makeItem({ id: 'paste', category: 'dental', group: 'Dental Care' }),
      makeItem({ id: 'liquid', category: 'kitchen', group: 'Dishwashing' }),
    ])
    const ids = await db.items
      .where('[category+group]')
      .equals(['kitchen', 'Dishwashing'])
      .primaryKeys()
    expect(ids).toEqual(['liquid'])
  })

  it('matches the compound index on both fields together, not either one alone', async () => {
    // 'Hand Soap' is a group in both hair and kitchen.
    await db.items.bulkPut([
      makeItem({ id: 'kitchen-soap', category: 'kitchen', group: 'Hand Soap' }),
      makeItem({ id: 'kitchen-soap-2', category: 'kitchen', group: 'Hand Soap' }),
      makeItem({ id: 'hair-soap', category: 'hair', group: 'Hand Soap' }),
      makeItem({ id: 'kitchen-dish', category: 'kitchen', group: 'Dishwashing' }),
      // An empty group is still a valid key, so the row stays in the index.
      makeItem({ id: 'kitchen-none', category: 'kitchen', group: '' }),
    ])
    const soap = await db.items
      .where('[category+group]')
      .equals(['kitchen', 'Hand Soap'])
      .primaryKeys()
    expect(soap.sort()).toEqual(['kitchen-soap', 'kitchen-soap-2'])
    const none = await db.items.where('[category+group]').equals(['kitchen', '']).primaryKeys()
    expect(none).toEqual(['kitchen-none'])
  })
})

describe('item record queries', () => {
  it('finds the records of one item by itemId', async () => {
    await db.itemPurchaseRecords.bulkPut([
      makeItemPurchaseRecord({ id: 'r1', itemId: 'soap' }),
      makeItemPurchaseRecord({ id: 'r2', itemId: 'sponges' }),
      makeItemPurchaseRecord({ id: 'r3', itemId: 'soap' }),
    ])
    const ids = await db.itemPurchaseRecords.where('itemId').equals('soap').primaryKeys()
    expect(ids.sort()).toEqual(['r1', 'r3'])
  })

  it('lists records in addedAt order', async () => {
    await db.itemPurchaseRecords.bulkPut([
      makeItemPurchaseRecord({ id: 'middle', addedAt: '2026-11-14T10:00:00.000Z' }),
      makeItemPurchaseRecord({ id: 'latest', addedAt: '2026-11-14T11:00:00.000Z' }),
      makeItemPurchaseRecord({ id: 'earliest', addedAt: '2026-11-14T09:00:00.000Z' }),
    ])
    const ids = await db.itemPurchaseRecords.orderBy('addedAt').primaryKeys()
    expect(ids).toEqual(['earliest', 'middle', 'latest'])
  })
})

describe('transactions', () => {
  it('rolls back every write when the transaction throws after writing', async () => {
    const before = makeItem({ id: 'a', name: 'Lemon Soap' })
    await db.items.put(before)

    await expect(
      db.transaction('rw', db.items, async () => {
        await db.items.put({ ...before, name: 'Lime Soap' })
        await db.items.put(makeItem({ id: 'b' }))
        // Inside the transaction the writes are already visible...
        expect(await db.items.get('a')).toMatchObject({ name: 'Lime Soap' })
        throw new Error('Invented failure after writing')
      }),
    ).rejects.toThrow('Invented failure after writing')

    // ...but once it has failed, neither the change nor the new row was kept.
    expect(await db.items.get('a')).toEqual(before)
    expect(await db.items.get('b')).toBeUndefined()
  })
})

describe('reopening', () => {
  it('keeps the rows of all four tables after closing and opening again', async () => {
    const user = makeUser()
    const household = makeHousehold()
    const item = makeItem()
    const record = makeItemPurchaseRecord()
    await db.users.put(user)
    await db.households.put(household)
    await db.items.put(item)
    await db.itemPurchaseRecords.put(record)
    db.close()

    // A new connection under the same name, as when the app starts again. It replaces `db`, so
    // afterEach deletes it.
    db = openDb(db.name)

    expect(await db.users.get(user.id)).toEqual(user)
    expect(await db.households.get(household.id)).toEqual(household)
    expect(await db.items.get(item.id)).toEqual(item)
    expect(await db.itemPurchaseRecords.get(record.id)).toEqual(record)
  })
})

describe('upgrading', () => {
  it('keeps an item through an upgrade to version 2 and finds it by the new index', async () => {
    const item = makeItem({ id: 'a', name: 'Lemon Soap' })
    await db.items.put(item) // opens the database at version 1
    db.close()

    // A test-only definition of the same database: version 1 exactly as ShelfieDB has it, then a
    // version 2 that adds a `name` index to items. ShelfieDB itself stays at version 1.
    const upgraded = new Dexie(db.name)
    const seenByUpgrade: Item[] = []
    upgraded.version(1).stores(STORES_V1)
    upgraded
      .version(2)
      .stores({ items: `${STORES_V1.items}, name` })
      .upgrade(async (tx) => {
        seenByUpgrade.push(...(await tx.table<Item, string>('items').toArray()))
      })

    try {
      const items = upgraded.table<Item, string>('items')
      expect(await items.get('a')).toEqual(item)
      expect(await items.where('name').equals('Lemon Soap').primaryKeys()).toEqual(['a'])
      // The upgrade function ran, once, and saw the version 1 row.
      expect(seenByUpgrade).toEqual([item])
      expect(upgraded.verno).toBe(2)
    } finally {
      upgraded.close()
    }
  })
})
