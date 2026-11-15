import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeHousehold, makeItemRecord, makeUser } from '../../domain/testing/helpers/fixtures'
import { openDb, type ShelfieDB } from '../db'

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
  it('creates the three tables when opened', async () => {
    await db.open()
    const storeNames = Array.from(db.backendDB().objectStoreNames).sort()
    expect(storeNames).toEqual(['households', 'items', 'users'])
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
    const item = makeItemRecord()
    await db.items.put(item)
    expect(await db.items.get(item.id)).toEqual(item)
  })
})

describe('item queries', () => {
  it('finds items by householdId', async () => {
    await db.items.bulkPut([
      makeItemRecord({ id: 'a', householdId: 'home' }),
      makeItemRecord({ id: 'b', householdId: 'cabin' }),
      makeItemRecord({ id: 'c', householdId: 'home' }),
    ])
    const ids = await db.items.where('householdId').equals('home').primaryKeys()
    expect(ids.sort()).toEqual(['a', 'c'])
  })

  it('finds items by [category+group]', async () => {
    await db.items.bulkPut([
      makeItemRecord({ id: 'paste', category: 'dental', group: 'Dental Care' }),
      makeItemRecord({ id: 'liquid', category: 'kitchen', group: 'Dishwashing' }),
    ])
    const ids = await db.items
      .where('[category+group]')
      .equals(['kitchen', 'Dishwashing'])
      .primaryKeys()
    expect(ids).toEqual(['liquid'])
  })

  it('lists items in updatedAt order', async () => {
    await db.items.bulkPut([
      makeItemRecord({ id: 'middle', updatedAt: '2026-11-14T10:00:00.000Z' }),
      makeItemRecord({ id: 'latest', updatedAt: '2026-11-14T11:00:00.000Z' }),
      makeItemRecord({ id: 'earliest', updatedAt: '2026-11-14T09:00:00.000Z' }),
    ])
    const ids = await db.items.orderBy('updatedAt').primaryKeys()
    expect(ids).toEqual(['earliest', 'middle', 'latest'])
  })

  it('matches the compound index on both fields together, not either one alone', async () => {
    // 'Hand Soap' is a group in both hair and kitchen.
    await db.items.bulkPut([
      makeItemRecord({ id: 'kitchen-soap', category: 'kitchen', group: 'Hand Soap' }),
      makeItemRecord({ id: 'kitchen-soap-2', category: 'kitchen', group: 'Hand Soap' }),
      makeItemRecord({ id: 'hair-soap', category: 'hair', group: 'Hand Soap' }),
      makeItemRecord({ id: 'kitchen-dish', category: 'kitchen', group: 'Dishwashing' }),
      // An empty group is still a valid key, so the row stays in the index.
      makeItemRecord({ id: 'kitchen-none', category: 'kitchen', group: '' }),
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
