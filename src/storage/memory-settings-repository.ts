// The in-memory settings repository, for tests and the UI before the database is wired in.
// Behaves exactly like the Dexie one: the rules are in settings-repository.ts. No Dexie here.
//
// It keeps the `user` and `household` objects it is given as its store, and an update replaces
// only their prefs field, in place. So whoever created it can read the stored rows (as the
// contract test does); app code should pass rows it won't change itself.

import { mergeHouseholdPrefs, type Household } from '../domain/household'
import { mergeUserPrefs, type User } from '../domain/user'
import { createListeners } from './repository'
import { applyPrefsChange, samePrefs, type SettingsRepository } from './settings-repository'

export function createMemorySettingsRepository({
  user,
  household,
}: {
  user: User
  household: Household
}): SettingsRepository {
  const listeners = createListeners('SettingsRepository')

  return {
    async getUserPrefs() {
      return mergeUserPrefs(user.userPrefs)
    },

    async updateUserPrefs(change) {
      const current = mergeUserPrefs(user.userPrefs)
      const next = applyPrefsChange(current, change, mergeUserPrefs, 'userPrefs')
      if (samePrefs(current, next)) return next
      user.userPrefs = structuredClone(next)
      listeners.notify()
      return next
    },

    async getHouseholdPrefs() {
      return mergeHouseholdPrefs(household.householdPrefs)
    },

    async updateHouseholdPrefs(change) {
      const current = mergeHouseholdPrefs(household.householdPrefs)
      const next = applyPrefsChange(current, change, mergeHouseholdPrefs, 'householdPrefs')
      if (samePrefs(current, next)) return next
      household.householdPrefs = structuredClone(next)
      listeners.notify()
      return next
    },

    subscribe: listeners.subscribe,
  }
}
