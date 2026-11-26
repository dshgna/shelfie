import 'fake-indexeddb/auto'
import type { Transaction } from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../../domain/item'
import { defaultHouseholdPrefs } from '../../domain/household'
import { defaultUserPrefs } from '../../domain/user'
import { makeHousehold, makeItem, makeUser } from '../../domain/testing/helpers/fixtures'
import { openDb, userDbName, type ShelfieDB } from '../db'
import { ensureLocalProfile, openUserProfile, type FirstRunDeps } from '../firstRun'

/** An invented signed-in account id (the Supabase user id). */
const USER_ID = '0b7e3c1a-1111-4aaa-8bbb-000000000001'

// Each test gets its own database, deleted afterwards, so no test sees another's rows.
let dbCount = 0
let db: ShelfieDB

beforeEach(() => {
  dbCount += 1
  db = openDb(`first-run-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

/** A fake clock and id maker that count how often they are called. */
function fakeDeps() {
  const calls = { now: 0, newId: 0 }
  const deps: FirstRunDeps = {
    now: () => {
      calls.now += 1
      return new Date(Date.UTC(2026, 10, 14, 9, 30, calls.now))
    },
    newId: () => {
      calls.newId += 1
      return `fake-id-${calls.newId}`
    },
  }
  return { deps, calls }
}

describe('ensureLocalProfile', () => {
  it('gives the local user the signed-in account id, and a new id only to the household', async () => {
    const { deps, calls } = fakeDeps()

    const { user, household } = await ensureLocalProfile(db, USER_ID, deps)

    expect(user.id).toBe(USER_ID)
    expect(user.householdId).toBe(household.id)
    expect(calls.newId).toBe(1)
  })

  it('refuses a database that belongs to another account, and writes nothing', async () => {
    const { deps } = fakeDeps()
    const first = await ensureLocalProfile(db, USER_ID, deps)

    await expect(ensureLocalProfile(db, 'someone-else', deps)).rejects.toThrow(
      `This database belongs to user ${USER_ID}, not someone-else`,
    )
    expect(await db.users.toArray()).toEqual([first.user])
    expect(await db.households.toArray()).toEqual([first.household])
  })

  it('creates exactly one household and one user on first run, in one transaction', async () => {
    const transactions: Transaction[] = []
    db.households.hook('creating', (_key, _row, tx) => {
      transactions.push(tx)
    })
    db.users.hook('creating', (_key, _row, tx) => {
      transactions.push(tx)
    })
    const { deps } = fakeDeps()

    const { user, household } = await ensureLocalProfile(db, USER_ID, deps)

    expect(household).toEqual({
      id: 'fake-id-1',
      createdAt: '2026-11-14T09:30:01.000Z',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      householdPrefs: defaultHouseholdPrefs(),
    })
    expect(user).toEqual({
      id: USER_ID,
      householdId: 'fake-id-1',
      createdAt: '2026-11-14T09:30:01.000Z',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      userPrefs: defaultUserPrefs(),
      syncOn: false,
    })
    expect(await db.households.toArray()).toEqual([household])
    expect(await db.users.toArray()).toEqual([user])
    // Both rows were written by the same transaction.
    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toBe(transactions[1])
  })

  it('creates nothing on a second call and returns the same rows', async () => {
    const { deps, calls } = fakeDeps()
    const first = await ensureLocalProfile(db, USER_ID, deps)
    const callsAfterFirst = { ...calls }

    let writes = 0
    db.households.hook('creating', () => {
      writes += 1
    })
    db.users.hook('creating', () => {
      writes += 1
    })
    const second = await ensureLocalProfile(db, USER_ID, deps)

    expect(second).toEqual(first)
    // No new ids or times were asked for, and nothing was written.
    expect(calls).toEqual(callsAfterFirst)
    expect(writes).toBe(0)
    expect(await db.households.count()).toBe(1)
    expect(await db.users.count()).toBe(1)
  })

  it('leaves neither row behind if the transaction fails halfway', async () => {
    // The household is added first; make the user's add fail after it.
    db.users.hook('creating', () => {
      throw new Error('Invented failure while adding the user')
    })
    const { deps } = fakeDeps()

    await expect(ensureLocalProfile(db, USER_ID, deps)).rejects.toThrow(
      'Invented failure while adding the user',
    )
    expect(await db.households.count()).toBe(0)
    expect(await db.users.count()).toBe(0)
  })

  it('creates one profile when two calls start at the same time', async () => {
    const { deps } = fakeDeps()

    const [first, second] = await Promise.all([
      ensureLocalProfile(db, USER_ID, deps),
      ensureLocalProfile(db, USER_ID, deps),
    ])

    expect(second).toEqual(first)
    expect(await db.households.count()).toBe(1)
    expect(await db.users.count()).toBe(1)
  })

  it('throws when the user points at a missing household, and writes nothing', async () => {
    const user = makeUser({ id: 'orphan-user', householdId: 'missing-household' })
    await db.users.put(user)
    const { deps, calls } = fakeDeps()

    await expect(ensureLocalProfile(db, 'orphan-user', deps)).rejects.toThrow(
      'User orphan-user points at household missing-household, which is missing',
    )
    expect(await db.users.toArray()).toEqual([user])
    expect(await db.households.count()).toBe(0)
    expect(calls).toEqual({ now: 0, newId: 0 })
  })

  // Records what happens today; it is not a decision that this is right. If ensureLocalProfile
  // is changed to reuse the existing household, change this test with it.
  it('today: with a household but no user, adds a second household and leaves the first without a user', async () => {
    const lone = makeHousehold({ id: 'lone-household' })
    await db.households.put(lone)
    const { deps } = fakeDeps()

    const { user, household } = await ensureLocalProfile(db, USER_ID, deps)

    expect(household.id).toBe('fake-id-1')
    expect(user.householdId).toBe('fake-id-1')
    expect(await db.households.get('lone-household')).toEqual(lone)
    const householdIds = (await db.households.toArray()).map((row) => row.id).sort()
    expect(householdIds).toEqual(['fake-id-1', 'lone-household'])
    expect(await db.users.where('householdId').equals('lone-household').count()).toBe(0)
  })
})

describe('openUserProfile', () => {
  const USER_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
  const USER_B = 'bbbbbbbb-0000-4000-8000-00000000000b'
  const opened: ShelfieDB[] = []

  afterEach(async () => {
    for (const userDb of opened.splice(0)) await userDb.delete()
  })

  async function open(userId: string, deps: FirstRunDeps) {
    const profile = await openUserProfile(userId, deps)
    opened.push(profile.db)
    return profile
  }

  it('opens a database named after the account', async () => {
    const { db: userDb, user } = await open(USER_A, fakeDeps().deps)

    expect(userDb.name).toBe(`shelfie-${USER_A}`)
    expect(userDbName(USER_A)).toBe(`shelfie-${USER_A}`)
    expect(user.id).toBe(USER_A)
  })

  it("keeps each account's data apart, and keeps it after signing out", async () => {
    const { deps } = fakeDeps()
    const a = await open(USER_A, deps)
    await a.db.items.put(makeItem({ id: 'invented-item', householdId: a.household.id }))
    a.db.close() // signing out closes the database; nothing is deleted

    const b = await open(USER_B, deps)
    expect(b.user.id).toBe(USER_B)
    expect(b.household.id).not.toBe(a.household.id)
    expect(await b.db.items.count()).toBe(0)
    expect(await b.db.users.toArray()).toEqual([b.user])
    b.db.close()

    // Signing back in as A finds A's profile and data as they were.
    const again = await open(USER_A, deps)
    expect(again.user).toEqual(a.user)
    expect(again.household).toEqual(a.household)
    expect(await again.db.items.count()).toBe(1)
  })

  it('refuses an id that is not a plain account id', () => {
    expect(() => userDbName('')).toThrow()
    expect(() => userDbName('../other')).toThrow()
    expect(() => userDbName('a b')).toThrow()
  })
})
