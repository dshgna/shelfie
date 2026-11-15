// An item as the storage layer keeps it: the Item itself plus bookkeeping fields.
// Types only: storing it is the storage layer's job (src/storage, step 3).
// Item, its validation and its migrations are unchanged; these fields sit beside them.

import type { IsoDateTime } from './dates'
import type { Item } from './item'

export type ItemRecord = Item & {
  /** The household the item belongs to. */
  householdId: string
  /** When the item was first saved, in UTC. */
  createdAt: IsoDateTime
  /** When the item was last changed, in UTC. Sync uses it to tell which copy is newer. */
  updatedAt: IsoDateTime
  /**
   * True when the item has been removed. The record is kept, marked instead of erased, so that
   * other devices can learn the item is gone the next time they sync; a record that simply
   * disappeared would look the same as one they haven't received yet.
   */
  deleted: boolean
}
