// The device's IndexedDB database, through Dexie. src/storage is the only place that may import
// Dexie: the rest of the app reaches stored data through this folder.
//
// Two kinds of version, which change for different reasons:
// - Dexie's database version (the number in `this.version(1)` below) describes the tables and
//   their indexes. It changes when a table or index is added, removed or changed: add
//   `this.version(2).stores(...)` with an `.upgrade(...)` function beside version 1. Never edit
//   version 1 once real data exists, because devices that already have it would not be upgraded.
// - The `schemaVersion` on each record describes the shape of that record's data. It changes when
//   a field is added, renamed or reshaped, and comes with a migration in src/domain.
//
// Indexes:
// - `deleted` is not indexed on purpose. IndexedDB cannot use true or false as a key, so every
//   row would silently drop out of such an index. To get the items that are not deleted, load
//   them by householdId and filter in memory.
// - IndexedDB also leaves a row out of an index when the indexed field is missing. Every indexed
//   field below is required by its type (`householdId`, `category`, `group` and `updatedAt` on
//   items; `itemId` and `addedAt` on purchase records), so no row drops out.

import Dexie, { type Table } from 'dexie'
import type { Household } from '../domain/household'
import type { Item } from '../domain/item'
import type { ItemPurchaseRecord } from '../domain/item-purchase-record'
import type { User } from '../domain/user'

export class ShelfieDB extends Dexie {
  declare users: Table<User, string>
  declare households: Table<Household, string>
  declare items: Table<Item, string>
  /** One row each time an item is bought. */
  declare itemPurchaseRecords: Table<ItemPurchaseRecord, string>

  constructor(name = 'shelfie') {
    super(name)
    this.version(1).stores({
      users: 'id, householdId',
      households: 'id',
      items: 'id, householdId, [category+group], updatedAt',
      // itemId finds every purchase of one item; addedAt lists them in the order they were added.
      itemPurchaseRecords: 'id, itemId, addedAt',
    })
  }
}

/** Opens the database. A factory rather than a module-level instance, so importing this module never touches IndexedDB. */
export function openDb(name?: string): ShelfieDB {
  return new ShelfieDB(name)
}
