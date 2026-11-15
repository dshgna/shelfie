// A household: the inventory's owner. Items belong to a household, and users join one.
// Types only: storing it is the storage layer's job (src/storage, step 3).

import type { IsoDateTime } from './dates'
import { CURRENT_SCHEMA_VERSION, type ReorderShare } from './item'
import { DEFAULT_SHARE } from './status'

/**
 * Defaults set for the whole household, so everyone sharing the shelves gets the same ones.
 * Deliberately minimal: add a field only when a feature needs it. How the app looks to one
 * person belongs in UserPrefs (user.ts) instead.
 */
export interface HouseholdPrefs {
  /** The reorder share new items start with (0.9 = reorder when 10% is left). */
  reorderDefaultShare: ReorderShare
}

/** Defaults for a new household: reorder at DEFAULT_SHARE. A new object each time. */
export function defaultHouseholdPrefs(): HouseholdPrefs {
  return { reorderDefaultShare: DEFAULT_SHARE }
}

export interface Household {
  /** Unique id. */
  id: string
  /** Optional display name, such as "Home". Left out when the person hasn't named it. */
  name?: string
  /** When it was created, in UTC. */
  createdAt: IsoDateTime
  /** The shape version this record was stored at. */
  schemaVersion: number
  householdPrefs: HouseholdPrefs
}

/**
 * A new household with default preferences and no name. The caller passes the id and the current
 * moment, because domain code never makes ids or reads the clock.
 *
 * @throws RangeError if `now` is an Invalid Date (from toISOString).
 */
export function newHousehold({ id, now }: { id: string; now: Date }): Household {
  return {
    id,
    createdAt: now.toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    householdPrefs: defaultHouseholdPrefs(),
  }
}
