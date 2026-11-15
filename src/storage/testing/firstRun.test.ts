import 'fake-indexeddb/auto'
import type { Transaction } from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../../domain/item'
import { defaultHouseholdPrefs } from '../../domain/household'
import { defaultUserPrefs } from '../../domain/user'
import { openDb, type ShelfieDB } from '../db'
import { ensureLocalProfile, type FirstRunDeps } from '../firstRun'

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
      return `2026-11-14T09:30:0${calls.now}.000Z`
    },
    newId: () => {
      calls.newId += 1
      return `fake-id-${calls.newId}`
    },
  }
  return { deps, calls }
}

describe('ensureLocalProfile', () => {
  it('creates exactly one household and one user on first run, in one transaction', async () => {
    const transactions: Transaction[] = []
    db.households.hook('creating', (_key, _row, tx) => {
      transactions.push(tx)
    })
    db.users.hook('creating', (_key, _row, tx) => {
      transactions.push(tx)
    })
    const { deps } = fakeDeps()

    const { user, household } = await ensureLocalProfile(db, deps)

    expect(household).toEqual({
      id: 'fake-id-1',
      createdAt: '2026-11-14T09:30:01.000Z',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      householdPrefs: defaultHouseholdPrefs(),
    })
    expect(user).toEqual({
      id: 'fake-id-2',
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
    const first = await ensureLocalProfile(db, deps)
    const callsAfterFirst = { ...calls }

    let writes = 0
    db.households.hook('creating', () => {
      writes += 1
    })
    db.users.hook('creating', () => {
      writes += 1
    })
    const second = await ensureLocalProfile(db, deps)

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

    await expect(ensureLocalProfile(db, deps)).rejects.toThrow(
      'Invented failure while adding the user',
    )
    expect(await db.households.count()).toBe(0)
    expect(await db.users.count()).toBe(0)
  })
})
