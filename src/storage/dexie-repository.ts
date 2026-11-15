// The item repository on the device's IndexedDB database. Behaves exactly like the in-memory
// one: the rules are in repository.ts.
//
// Every write runs in a `db.transaction('rw', db.items, ...)` that awaits only Dexie calls (any
// other await would let IndexedDB commit the transaction early), and listeners are told only after
// the transaction has committed. IndexedDB copies what it stores and returns new objects on every
// read, so nothing handed in or out is shared with what is stored.

import type { Item } from '../domain/item'
import type { ShelfieDB } from './db'
import {
  checkSameHousehold,
  createListeners,
  readClock,
  type ItemRepository,
  type RepositoryClock,
} from './repository'

export function createDexieItemRepository(db: ShelfieDB, { now }: RepositoryClock): ItemRepository {
  const listeners = createListeners()

  return {
    async list(householdId) {
      // `deleted` can't be indexed (see db.ts), so load by householdId and filter here.
      const rows = await db.items.where('householdId').equals(householdId).toArray()
      return rows.filter((item) => !item.deleted)
    },

    async get(id) {
      const item = await db.items.get(id)
      return item && !item.deleted ? item : undefined
    },

    async put(item) {
      const updatedAt = readClock(now)
      const stored: Item = { ...structuredClone(item), updatedAt }
      // The household check reads the existing row in the same transaction as the write, so no
      // other write can slip in between. Throwing aborts the transaction: nothing is written.
      await db.transaction('rw', db.items, async () => {
        checkSameHousehold(await db.items.get(stored.id), stored)
        await db.items.put(stored)
      })
      listeners.notify()
      // `stored` is this call's own copy: IndexedDB kept a copy of it, not the object itself.
      return stored
    },

    async remove(id) {
      const updatedAt = readClock(now)
      const changed = await db.transaction('rw', db.items, async () => {
        const existing = await db.items.get(id)
        if (!existing || existing.deleted) return false
        await db.items.put({ ...existing, deleted: true, updatedAt })
        return true
      })
      if (changed) listeners.notify()
    },

    subscribe: listeners.subscribe,
  }
}
