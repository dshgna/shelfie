// The in-memory item repository, for tests and the UI before the database is wired in. Behaves
// exactly like the Dexie one: the rules are in repository.ts. It stores copies (structuredClone),
// as IndexedDB does. No Dexie here.
//
// `store` is optional: pass a Map to read the stored rows (deleted ones included) from outside, as
// the contract test does. Without one, the repository makes its own.

import type { Item } from '../domain/item'
import {
  checkSameHousehold,
  createListeners,
  readClock,
  type ItemRepository,
  type RepositoryClock,
} from './repository'

export function createMemoryItemRepository({
  now,
  store,
}: RepositoryClock & { store?: Map<string, Item> }): ItemRepository {
  const rows = store ?? new Map<string, Item>()
  const listeners = createListeners()

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
