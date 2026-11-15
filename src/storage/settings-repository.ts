// The settings repository: the one way the app reads and changes the user's and the household's
// preferences. Built like the item repository (repository.ts), with two versions that behave
// identically, proved by one shared contract test (testing/helpers/settingsRepositoryContract.ts):
// - createMemorySettingsRepository (memory-settings-repository.ts), for tests and the UI before
//   the database is wired in;
// - createDexieSettingsRepository (dexie-settings-repository.ts), for the app.
// Both are created for one profile: the user and household rows that ensureLocalProfile gives.
//
// This file must not import Dexie (src/storage-boundaries.test.ts checks it).
//
// The rules:
// - Reads are tolerant: `getUserPrefs` and `getHouseholdPrefs` run the stored value through
//   mergeUserPrefs or mergeHouseholdPrefs, so a row with a missing or bad field still gives a
//   complete, valid object.
// - Updates are strict: `update…` merges `change` into the current prefs and, if the merge
//   function would change any value the caller asked for (an invalid value or an unknown key),
//   rejects with a RangeError that names the field. Nothing is written.
// - An update that changes nothing (every value the same as the current prefs) writes nothing and
//   doesn't notify.
// - An update replaces only the `userPrefs` (or `householdPrefs`) field of the row. Other fields,
//   such as `syncOn` and the key fields, are never touched.
// - If the user or household row is missing, every method except `subscribe` rejects with an
//   error that says to run ensureLocalProfile first.
// - There is no clock: these rows have no timestamp. They are not synced yet.
// - The same rules as repository.ts for the rest: objects handed in and out are copies;
//   listeners run after the write has been saved, each in its own try/catch (one that throws
//   doesn't stop the others or fail the update, and is reported with console.error); and
//   `subscribe` only hears writes made through the same repository object, so the app should
//   create one and share it.

import type { HouseholdPrefs } from '../domain/household'
import type { UserPrefs } from '../domain/user'

export interface SettingsRepository {
  /** The user's preferences, complete and valid whatever the row holds. */
  getUserPrefs(): Promise<UserPrefs>
  /** Changes the given user preferences and returns the new ones. Rejects on an invalid change. */
  updateUserPrefs(change: Partial<UserPrefs>): Promise<UserPrefs>
  /** The household's preferences, complete and valid whatever the row holds. */
  getHouseholdPrefs(): Promise<HouseholdPrefs>
  /** Changes the given household preferences and returns the new ones. Rejects on an invalid change. */
  updateHouseholdPrefs(change: Partial<HouseholdPrefs>): Promise<HouseholdPrefs>
  /**
   * Calls `listener` after every update saved through this repository object (not other
   * repository objects or tabs). Returns a function that stops listening; calling it again does
   * nothing.
   */
  subscribe(listener: () => void): () => void
}

/** The profile a settings repository is created for: the rows ensureLocalProfile gives. */
export interface SettingsProfile {
  userId: string
  householdId: string
}

/** The error every method rejects with when the profile's user or household row is missing. */
export function missingProfileRow(kind: 'user' | 'household', id: string): Error {
  return new Error(
    `SettingsRepository: the ${kind} row "${id}" is missing. Run ensureLocalProfile first.`,
  )
}

/**
 * Applies `change` to `current` strictly.
 * @throws RangeError naming the field if `merge` would change a value the caller asked for: an
 * invalid value, or a key the prefs don't have.
 */
export function applyPrefsChange<T extends object>(
  current: T,
  change: Partial<T>,
  merge: (saved: unknown) => T,
  label: 'userPrefs' | 'householdPrefs',
): T {
  const next = merge({ ...current, ...change })
  const merged = next as Record<string, unknown>
  for (const [key, asked] of Object.entries(change)) {
    if (!(key in merged)) {
      throw new RangeError(`SettingsRepository: ${label} has no field "${key}"`)
    }
    if (!Object.is(merged[key], asked)) {
      throw new RangeError(`SettingsRepository: ${label}.${key} can't be ${String(asked)}`)
    }
  }
  return next
}

/** True when both prefs objects hold the same value for every field. */
export function samePrefs<T extends object>(a: T, b: T): boolean {
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...keys].every((key) => Object.is(left[key], right[key]))
}
