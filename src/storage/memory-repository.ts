// The in-memory item repository, for tests and the UI before the database is wired in. Behaves
// exactly like the Dexie one: the rules are in repository.ts. It stores copies (structuredClone),
// as IndexedDB does. No Dexie here.
//
// `store` and `purchases` are optional: pass Maps to read the stored items (deleted ones included)
// and purchase records from outside, as the contract test does. Without them, the repository makes
// its own.

import type { Item } from '../domain/item'
import type { ItemPurchaseRecord } from '../domain/item-purchase-record'
import {
  checkNewPurchase,
  checkSameHousehold,
  createListeners,
  readClock,
  type ItemRepository,
  type RepositoryClock,
} from './repository'

export function createMemoryItemRepository({
  now,
  store,
  purchases,
}: RepositoryClock & {
  store?: Map<string, Item>
  purchases?: Map<string, ItemPurchaseRecord>
}): ItemRepository {
  const rows = store ?? new Map<string, Item>()
  const records = purchases ?? new Map<string, ItemPurchaseRecord>()
  const listeners = createListeners('ItemRepository')

  return {
    async list(householdId) {
      return [...rows.values()]
        .filter((item) => item.householdId === householdId && !item.deleted)
        .map((item) => structuredClone(item))
    },

    async get(id) {
      const item = rows.get(id)
      return item && !item.deleted ? structuredClone(item) : undefined
    },

    async put(item) {
      const updatedAt = readClock(now)
      checkSameHousehold(rows.get(item.id), item)
      const stored: Item = { ...structuredClone(item), updatedAt }
      rows.set(stored.id, stored)
      listeners.notify()
      return structuredClone(stored)
    },

    async putWithPurchase(item, purchase) {
      const stamp = readClock(now)
      // Every check runs before either write, so a rejection leaves both maps as they were.
      checkSameHousehold(rows.get(item.id), item)
      checkNewPurchase(records.get(purchase.id), purchase, item)
      const storedItem: Item = { ...structuredClone(item), updatedAt: stamp }
      const storedPurchase: ItemPurchaseRecord = {
        ...structuredClone(purchase),
        addedAt: stamp,
        updatedAt: stamp,
      }
      rows.set(storedItem.id, storedItem)
      records.set(storedPurchase.id, storedPurchase)
      listeners.notify()
      return { item: structuredClone(storedItem), purchase: structuredClone(storedPurchase) }
    },

    async remove(id) {
      const updatedAt = readClock(now)
      const existing = rows.get(id)
      if (!existing || existing.deleted) return
      rows.set(id, { ...existing, deleted: true, updatedAt })
      listeners.notify()
    },

    subscribe: listeners.subscribe,
  }
}
