// Makes sure this device has a local profile: one household and one user who belongs to it.

import type { IsoDateTime } from '../domain/dates'
import { defaultHouseholdPrefs, type Household } from '../domain/household'
import { CURRENT_SCHEMA_VERSION } from '../domain/item'
import { defaultUserPrefs, type User } from '../domain/user'
import type { ShelfieDB } from './db'

export interface FirstRunDeps {
  /** The current moment. The app passes `() => new Date().toISOString()`. */
  now: () => IsoDateTime
  /** A new unique id. The app passes `() => crypto.randomUUID()`. */
  newId: () => string
}

/**
 * Returns the local user and their household. On first run (no user yet) it creates both in a
 * single transaction; otherwise it returns the existing rows without writing anything.
 */
export async function ensureLocalProfile(
  db: ShelfieDB,
  deps: FirstRunDeps,
): Promise<{ user: User; household: Household }> {
  // The check runs inside the same transaction as the writes, so two tabs opening at once
  // cannot both see "no user" and each create a profile.
  return db.transaction('rw', db.users, db.households, async () => {
    const existing = await db.users.toCollection().first()
    if (existing) {
      const household = await db.households.get(existing.householdId)
      if (!household) {
        throw new Error(
          `User ${existing.id} points at household ${existing.householdId}, which is missing`,
        )
      }
      return { user: existing, household }
    }

    const createdAt = deps.now()
    const household: Household = {
      id: deps.newId(),
      createdAt,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      householdPrefs: defaultHouseholdPrefs(),
    }
    const user: User = {
      id: deps.newId(),
      householdId: household.id,
      createdAt,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      userPrefs: defaultUserPrefs(),
      syncOn: false,
    }
    await db.households.add(household)
    await db.users.add(user)
    return { user, household }
  })
}
