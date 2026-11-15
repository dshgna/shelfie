// The settings repository on the device's IndexedDB database. Behaves exactly like the in-memory
// one: the rules are in settings-repository.ts.
//
// Every method reads both profile rows in one transaction over users and households, so it
// rejects the same way whichever row is missing. Each update reads and writes in the same
// `db.transaction('rw', db.users, db.households, ...)`, awaiting only Dexie calls, and listeners
// are told only after it has committed. `update(id, { userPrefs })` changes that one field of
// the row and leaves the rest as it is.

import { mergeHouseholdPrefs } from '../domain/household'
import { mergeUserPrefs } from '../domain/user'
import type { ShelfieDB } from './db'
import { createListeners } from './repository'
import {
  applyPrefsChange,
  missingProfileRow,
  samePrefs,
  type SettingsProfile,
  type SettingsRepository,
} from './settings-repository'

export function createDexieSettingsRepository(
  db: ShelfieDB,
  { userId, householdId }: SettingsProfile,
): SettingsRepository {
  const listeners = createListeners('SettingsRepository')

  /** Both profile rows. Call inside a transaction over db.users and db.households. */
  async function readProfile() {
    const user = await db.users.get(userId)
    if (!user) throw missingProfileRow('user', userId)
    const household = await db.households.get(householdId)
    if (!household) throw missingProfileRow('household', householdId)
    return { user, household }
  }

  return {
    async getUserPrefs() {
      const { user } = await db.transaction('r', db.users, db.households, readProfile)
      return mergeUserPrefs(user.userPrefs)
    },

    async updateUserPrefs(change) {
      const result = await db.transaction('rw', db.users, db.households, async () => {
        const { user } = await readProfile()
        const current = mergeUserPrefs(user.userPrefs)
        const next = applyPrefsChange(current, change, mergeUserPrefs, 'userPrefs')
        if (samePrefs(current, next)) return { next, changed: false }
        await db.users.update(userId, { userPrefs: next })
        return { next, changed: true }
      })
      if (result.changed) listeners.notify()
      return result.next
    },

    async getHouseholdPrefs() {
      const { household } = await db.transaction('r', db.users, db.households, readProfile)
      return mergeHouseholdPrefs(household.householdPrefs)
    },

    async updateHouseholdPrefs(change) {
      const result = await db.transaction('rw', db.users, db.households, async () => {
        const { household } = await readProfile()
        const current = mergeHouseholdPrefs(household.householdPrefs)
        const next = applyPrefsChange(current, change, mergeHouseholdPrefs, 'householdPrefs')
        if (samePrefs(current, next)) return { next, changed: false }
        await db.households.update(householdId, { householdPrefs: next })
        return { next, changed: true }
      })
      if (result.changed) listeners.notify()
      return result.next
    },

    subscribe: listeners.subscribe,
  }
}
