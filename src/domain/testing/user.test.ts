import { describe, expect, expectTypeOf, it } from 'vitest'
import { isValidIsoDateTime, type IsoDateTime } from '../dates'
import { CURRENT_SCHEMA_VERSION } from '../item'
import {
  defaultUserPrefs,
  newUser,
  type KdfParams,
  type Theme,
  type User,
  type UserPrefs,
} from '../user'
import { makeUser } from './helpers/fixtures'

// Invented example data. The salt and key check are made-up base64, not real key material.
const syncing = {
  id: 'user-1',
  householdId: 'household-1',
  createdAt: '2026-11-15T09:30:00.000Z',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  userPrefs: { theme: 'dark' },
  syncOn: true,
  keySalt: 'ZXhhbXBsZS1zYWx0',
  kdfParams: { algorithm: 'PBKDF2-SHA256', iterations: 600_000, keyLengthBits: 256 },
  keyCheck: 'ZXhhbXBsZS1jaGVjaw==',
  lastSyncAt: '2026-11-15T10:05:00.000Z',
} satisfies User

// A minimal user: sync off, so no key fields and no last sync.
const local = {
  id: 'user-2',
  householdId: 'household-1',
  createdAt: '2026-11-15T09:30:00.000Z',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  userPrefs: defaultUserPrefs(),
  syncOn: false,
} satisfies User

describe('User type', () => {
  it('accepts syncing and local-only invented users', () => {
    expect(syncing.kdfParams.algorithm).toBe('PBKDF2-SHA256')
    expect('keySalt' in local).toBe(false)
  })

  it('types the important fields', () => {
    expectTypeOf<User['id']>().toEqualTypeOf<string>()
    expectTypeOf<User['householdId']>().toEqualTypeOf<string>()
    expectTypeOf<User['createdAt']>().toEqualTypeOf<IsoDateTime>()
    expectTypeOf<User['schemaVersion']>().toEqualTypeOf<number>()
    expectTypeOf<User['userPrefs']>().toEqualTypeOf<UserPrefs>()
    expectTypeOf<User['syncOn']>().toEqualTypeOf<boolean>()
    // Key material is only there once sync is set up, so it may be missing.
    expectTypeOf<User['keySalt']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<User['kdfParams']>().toEqualTypeOf<KdfParams | undefined>()
    expectTypeOf<User['keyCheck']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<User['lastSyncAt']>().toEqualTypeOf<IsoDateTime | undefined>()
  })

  it('has no field for the passphrase or the key: they are never stored', () => {
    type Has<K extends string> = K extends keyof User ? true : false
    expectTypeOf<Has<'passphrase'>>().toEqualTypeOf<false>()
    expectTypeOf<Has<'key'>>().toEqualTypeOf<false>()
    expectTypeOf<Has<'secret'>>().toEqualTypeOf<false>()
  })

  it('rejects values it never stores', () => {
    type Sha1Params = { algorithm: 'PBKDF2-SHA1'; iterations: number; keyLengthBits: number }
    // @ts-expect-error: only PBKDF2 with SHA-256 is used
    expectTypeOf<Sha1Params>().toExtend<KdfParams>()
    // @ts-expect-error: 'blue' is not a theme
    expectTypeOf<'blue'>().toExtend<Theme>()
    // @ts-expect-error: lastSyncAt is text, not a Date
    expectTypeOf<Date>().toExtend<User['lastSyncAt']>()
  })

  it('has a valid fixture: local-only, default preferences', () => {
    const user = makeUser()
    expect(user.syncOn).toBe(false)
    expect(user.userPrefs).toEqual(defaultUserPrefs())
    expect(isValidIsoDateTime(user.createdAt)).toBe(true)
  })
})

describe('UserPrefs', () => {
  it('types the preference fields', () => {
    expectTypeOf<UserPrefs['theme']>().toEqualTypeOf<Theme>()
  })

  it('defaults to the system theme', () => {
    expect(defaultUserPrefs()).toEqual({ theme: 'system' })
  })

  it('gives a new object each time, so changing one never changes another', () => {
    const first = defaultUserPrefs()
    first.theme = 'dark'
    expect(defaultUserPrefs().theme).toBe('system')
    expect(defaultUserPrefs()).not.toBe(defaultUserPrefs())
  })
})

describe('newUser', () => {
  const now = new Date(Date.UTC(2026, 10, 15, 9, 30))

  it('builds a user from the ids and moment it is given', () => {
    expect(newUser({ id: 'user-9', householdId: 'household-9', now })).toEqual({
      id: 'user-9',
      householdId: 'household-9',
      createdAt: '2026-11-15T09:30:00.000Z',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      userPrefs: { theme: 'system' },
      syncOn: false,
    })
  })

  it('writes createdAt as the exact ISO text, with sync off and no key fields', () => {
    const user = newUser({ id: 'user-9', householdId: 'household-9', now })
    expect(user.createdAt).toBe(now.toISOString())
    expect(isValidIsoDateTime(user.createdAt)).toBe(true)
    expect(user.syncOn).toBe(false)
    for (const field of ['keySalt', 'kdfParams', 'keyCheck', 'lastSyncAt']) {
      expect(field in user, field).toBe(false)
    }
  })

  it('throws for an Invalid Date', () => {
    expect(() => newUser({ id: 'u', householdId: 'h', now: new Date('nope') })).toThrow(RangeError)
  })
})
