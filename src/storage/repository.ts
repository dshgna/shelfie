// The item repository: the one way the rest of the app (the UI, later the sync code) reads and
// writes items. Two versions behave identically, proved by one shared contract test
// (testing/helpers/itemRepositoryContract.ts):
// - createMemoryItemRepository (memory-repository.ts), for tests and the UI before the database
//   is wired in;
// - createDexieItemRepository (dexie-repository.ts), for the app.
//
// This file must not import Dexie (src/storage-boundaries.test.ts checks it).
//
// The rules:
// - `put` sets `updatedAt` from the clock, whatever the item says. It doesn't change the object
//   passed in, and otherwise stores exactly what it was given, `deleted` included: putting an item
//   with `deleted: false` restores a removed one. It doesn't validate: callers run validateItem
//   (and normalizeItem) first.
// - `put` never moves an item to another household: if a row with the same id already exists,
//   deleted or not, and its householdId differs from the item's, `put` rejects with
//   ItemHouseholdMismatchError, writes nothing and doesn't notify. (The Dexie version checks
//   inside the same transaction as the write.)
// - `remove` never deletes the row: it sets `deleted: true` and `updatedAt`, so other devices can
//   learn the item is gone. Removing an id that doesn't exist or is already deleted does nothing:
//   it resolves, changes nothing, doesn't touch `updatedAt` and doesn't notify.
// - If the clock gives something that isn't a valid IsoDateTime, `put` and `remove` reject with a
//   RangeError, write nothing and don't notify. They always read the clock first, so this holds
//   even for a `remove` of an id that doesn't exist.
// - `list` and `get` hide deleted items. (Sync will need to see them; that is a later method.)
// - Objects handed in and out are copies: changing an object you got back, or the one you passed
//   to `put`, never changes what is stored.
// - Listeners run after the write has been saved (for Dexie, after the transaction has committed),
//   never inside it. Each listener runs in its own try/catch: one that throws doesn't stop the
//   others or make the write fail, and its error is reported with console.error.
// - `subscribe` only hears writes made through the same repository object. The app should create
//   one repository and share it. Writes through another repository object, or from another browser
//   tab, are not heard: that needs a different mechanism later (Dexie's liveQuery or a
//   BroadcastChannel).

import { isValidIsoDateTime, type IsoDateTime } from '../domain/dates'
import type { Item } from '../domain/item'

export interface ItemRepository {
  /** The household's items that are not deleted, in no particular order (the UI sorts). */
  list(householdId: string): Promise<Item[]>
  /** The item, or undefined if it doesn't exist or is deleted. */
  get(id: string): Promise<Item | undefined>
  /**
   * Saves a new or changed item, stamping `updatedAt` from the clock, and returns what was stored.
   * An Item is accepted too; its `updatedAt` is replaced. Rejects with
   * ItemHouseholdMismatchError if the id is already stored in another household.
   */
  put(item: Omit<Item, 'updatedAt'>): Promise<Item>
  /** Marks the item deleted and stamps `updatedAt`. Does nothing for a missing or deleted id. */
  remove(id: string): Promise<void>
  /**
   * Calls `listener` after every change saved through this repository object (not other
   * repository objects or tabs). Returns a function that stops listening; calling it again does
   * nothing.
   */
  subscribe(listener: () => void): () => void
}

/**
 * Why `put` rejected: an item with this id is already stored in another household, and `put`
 * never moves an item between households. Nothing was written.
 */
export class ItemHouseholdMismatchError extends Error {
  constructor(itemId: string, storedHouseholdId: string, householdId: string) {
    super(
      `ItemRepository: item "${itemId}" is stored in household "${storedHouseholdId}", ` +
        `so it can't be saved in household "${householdId}"`,
    )
    this.name = 'ItemHouseholdMismatchError'
  }
}

/**
 * Rejects a put that would move a stored item to another household.
 * @throws ItemHouseholdMismatchError if `existing` is in a different household from `item`.
 */
export function checkSameHousehold(
  existing: Item | undefined,
  item: Pick<Item, 'id' | 'householdId'>,
): void {
  if (existing && existing.householdId !== item.householdId) {
    throw new ItemHouseholdMismatchError(item.id, existing.householdId, item.householdId)
  }
}

/** What both repositories take, so tests control the clock. The app passes the real time. */
export interface RepositoryClock {
  /** The current moment. The app passes `() => new Date().toISOString()`. */
  now: () => IsoDateTime
}

/**
 * Reads the clock for a write.
 * @throws RangeError if the clock gives something that isn't a valid IsoDateTime.
 */
export function readClock(now: () => IsoDateTime): IsoDateTime {
  const value = now()
  if (!isValidIsoDateTime(value)) {
    throw new RangeError(`ItemRepository: the clock gave "${value}", not a valid date and time`)
  }
  return value
}

/** The listener list both repositories share: subscribe, and notify after a saved write. */
export function createListeners(): {
  subscribe: (listener: () => void) => () => void
  notify: () => void
} {
  // One entry per subscription, so subscribing the same function twice gives two independent
  // subscriptions, and each unsubscribe removes only its own.
  const subscriptions = new Set<{ listener: () => void }>()
  return {
    subscribe(listener) {
      const subscription = { listener }
      subscriptions.add(subscription)
      return () => {
        subscriptions.delete(subscription)
      }
    },
    notify() {
      // A copy, so a listener that subscribes or unsubscribes doesn't change this round.
      for (const { listener } of [...subscriptions]) {
        try {
          listener()
        } catch (error) {
          console.error('ItemRepository: a change listener threw', error)
        }
      }
    },
  }
}
