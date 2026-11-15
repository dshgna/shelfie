// One row each time an item is bought.
// Types only: storing it is the storage layer's job (src/storage, step 3).

import type { IsoDate, IsoDateTime } from './dates'
import type { Unit } from './item'

export interface ItemPurchaseRecord {
  /** The shape version this record was stored at (the shared CURRENT_SCHEMA_VERSION). */
  schemaVersion: number
  /** Unique id. */
  id: string
  /** The id of the item this purchase belongs to. */
  itemId: string
  /**
   * How many were bought: a whole number, 1 or more (a purchase of 0 isn't a purchase).
   * The type can't express that rule, so check it with isValidRecordQuantity.
   */
  quantity: number
  /** Free text such as "500 ml", as bought this time; '' when not known. */
  size: string
  /** The unit bought this time (tube, bottle, or the person's own). */
  unit: Unit
  /** The expiry date the person entered. Left out when none was given. */
  expiresOn?: IsoDate
  /** The day it was bought. */
  boughtAt: IsoDate
  /** When this record was added, in UTC. The itemPurchaseRecords table lists them in this order. */
  addedAt: IsoDateTime
  /** When this record was last changed, in UTC. Sync uses it to tell which copy is newer. */
  updatedAt: IsoDateTime
  // No `deleted` field: people can't delete a purchase record.
}

/** True when `quantity` is a whole number, 1 or more: the rule for ItemPurchaseRecord.quantity. */
export function isValidRecordQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1
}
