// Makes sure the signed-in account has a local profile on this device: one household and one user
// who belongs to it. It runs only after sign-in: the local user's id is the Supabase user id, and
// each account has its own database (userDbName), so data from one account never shows for
// another. The household is created locally.

import { newHousehold, type Household } from '../domain/household'
import { newUser, type User } from '../domain/user'
import { openDb, userDbName, type ShelfieDB } from './db'

export interface FirstRunDeps {
  /** The current moment. The app passes `() => new Date()`. */
  now: () => Date
  /** A new unique id, for the household. The app passes `() => crypto.randomUUID()`. */
  newId: () => string
}

/**
 * Returns the local user (whose id is `userId`, the signed-in account's id) and their household.
 * On first run (no user yet) it creates both in a single transaction; otherwise it returns the
 * existing rows without writing anything. Throws if the database belongs to another account.
 */
export async function ensureLocalProfile(
  db: ShelfieDB,
  userId: string,
  deps: FirstRunDeps,
): Promise<{ user: User; household: Household }> {
  // The check runs inside the same transaction as the writes, so two tabs opening at once
  // cannot both see "no user" and each create a profile.
  return db.transaction('rw', db.users, db.households, async () => {
    const existing = await db.users.toCollection().first()
    if (existing) {
      if (existing.id !== userId) {
        throw new Error(`This database belongs to user ${existing.id}, not ${userId}`)
      }
      const household = await db.households.get(existing.householdId)
      if (!household) {
        throw new Error(
          `User ${existing.id} points at household ${existing.householdId}, which is missing`,
        )
      }
      return { user: existing, household }
    }

    const now = deps.now()
    const household = newHousehold({ id: deps.newId(), now })
    const user = newUser({ id: userId, householdId: household.id, now })
    await db.households.add(household)
    await db.users.add(user)
    return { user, household }
  })
}

/**
 * Opens the signed-in account's own database and makes sure it has a profile. The caller closes
 * `db` when the account signs out; the data stays on the device.
 */
export async function openUserProfile(
  userId: string,
  deps: FirstRunDeps,
): Promise<{ db: ShelfieDB; user: User; household: Household }> {
  const db = openDb(userDbName(userId))
  try {
    return { db, ...(await ensureLocalProfile(db, userId, deps)) }
  } catch (error) {
    db.close()
    throw error
  }
}
