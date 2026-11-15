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
//   field below is required by its type (`category` and `group` included), so no row drops out.

import Dexie, { type Table } from 'dexie'
import type { Household } from '../domain/household'
import type { ItemRecord } from '../domain/item-record'
import type { User } from '../domain/user'

export class ShelfieDB extends Dexie {
  declare users: Table<User, string>
  declare households: Table<Household, string>
  declare items: Table<ItemRecord, string>

  constructor(name = 'shelfie') {
    super(name)
    this.version(1).stores({
      users: 'id, householdId',
      households: 'id',
      items: 'id, householdId, [category+group], updatedAt',
    })
  }
}

/** Opens the database. A factory rather than a module-level instance, so importing this module never touches IndexedDB. */
export function openDb(name?: string): ShelfieDB {
  return new ShelfieDB(name)
}
