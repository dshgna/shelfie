// The device's IndexedDB database, through Dexie. src/storage is the only place that may import
// Dexie: the rest of the app reaches stored data through this folder.
//
// Two kinds of version, which change for different reasons:
// - Dexie's database version (the number in `this.version(1)` below) describes the tables and
//   their indexes.
// - The `schemaVersion` on each record describes the shape of that record's data.
// Until launch, no real data exists, so the schema is changed in place: both stay at 1 and version
// 1 is edited directly. From launch, any change bumps schemaVersion and the Dexie version
// (`this.version(2).stores(...)` with an `.upgrade(...)` function beside version 1, which is then
// never edited again) and adds a migration.
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

/**
 * The tables and indexes of database version 1. Exported so a test can rebuild version 1 exactly
 * when it checks an upgrade to a later version. Never change it once real data exists: add a new
 * version instead (see the top of this file).
 */
export const STORES_V1 = {
  users: 'id, householdId',
  households: 'id',
  items: 'id, householdId, [category+group], updatedAt',
  // itemId finds every purchase of one item; addedAt lists them in the order they were added.
  itemPurchaseRecords: 'id, itemId, addedAt',
} as const

export class ShelfieDB extends Dexie {
  declare users: Table<User, string>
  declare households: Table<Household, string>
  declare items: Table<Item, string>
  /** One row each time an item is bought. */
  declare itemPurchaseRecords: Table<ItemPurchaseRecord, string>

  constructor(name = 'shelfie') {
    super(name)
    this.version(1).stores(STORES_V1)
  }
}

/** Opens the database. A factory rather than a module-level instance, so importing this module never touches IndexedDB. */
export function openDb(name?: string): ShelfieDB {
  return new ShelfieDB(name)
}
