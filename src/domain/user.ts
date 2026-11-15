// A person using Shelfie on this device, their preferences, and what their device needs to
// rebuild the encryption key from their passphrase when sync is on.
// Types only: storing it is the storage layer's job (src/storage, step 3); deriving the key is
// src/crypto (step 5).
//
// The passphrase and the key are never stored, anywhere. The salt, the key settings and the key
// check below are not secret: on their own they can't recover the passphrase or the key, and the
// device needs them to derive the same key again and to tell whether a passphrase is right.

import type { IsoDateTime } from './dates'
import { CURRENT_SCHEMA_VERSION } from './item'

/** The theme choice. 'system' follows the device's light or dark setting. */
export type Theme = 'system' | 'light' | 'dark'

/**
 * The person's own preferences: how the app looks to them. Deliberately minimal: add a field only
 * when a feature needs it. Defaults that everyone sharing the shelves should see the same way
 * belong in HouseholdPrefs (household.ts) instead.
 */
export interface UserPrefs {
  theme: Theme
}

/** Preferences for a new user: follow the device's theme. A new object each time. */
export function defaultUserPrefs(): UserPrefs {
  return { theme: 'system' }
}

/** How the key is derived from the passphrase (Web Crypto PBKDF2 with SHA-256). Not secret. */
export interface KdfParams {
  algorithm: 'PBKDF2-SHA256'
  /** How many times the hash is repeated: more is slower to guess. */
  iterations: number
  /** Length of the derived key, in bits. */
  keyLengthBits: number
}

export interface User {
  /** Unique id. */
  id: string
  /** The household whose shelves this person uses. */
  householdId: string
  /** When the user was created, in UTC. */
  createdAt: IsoDateTime
  /** The shape version this record was stored at. */
  schemaVersion: number
  userPrefs: UserPrefs
  /** True when encrypted sync is turned on. */
  syncOn: boolean
  /**
   * Random salt for deriving the key, as base64. Set when the passphrase is first chosen.
   * Not secret.
   */
  keySalt?: string
  /** The settings the key was derived with, so the same key can be derived again. Not secret. */
  kdfParams?: KdfParams
  /**
   * A small known value encrypted with the key, as base64. Decrypting it shows whether a
   * passphrase is the right one, without storing the passphrase or the key. Not secret.
   */
  keyCheck?: string
  /** When this device last finished a sync, in UTC. Left out if it never has. */
  lastSyncAt?: IsoDateTime
}

/**
 * A new user in `householdId`, with default preferences and sync off (so no key fields). The
 * caller passes the id and the current moment, because domain code never makes ids or reads the
 * clock.
 *
 * @throws RangeError if `now` is an Invalid Date (from toISOString).
 */
export function newUser({
  id,
  householdId,
  now,
}: {
  id: string
  householdId: string
  now: Date
}): User {
  return {
    id,
    householdId,
    createdAt: now.toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    userPrefs: defaultUserPrefs(),
    syncOn: false,
  }
}
