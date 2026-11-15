import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { HouseholdPrefs } from '../../domain/household'
import type { UserPrefs } from '../../domain/user'
import { openDb, type ShelfieDB } from '../db'
import { createDexieSettingsRepository } from '../dexie-settings-repository'
import type { SettingsRepository } from '../settings-repository'
import {
  contractHousehold,
  contractUser,
  describeSettingsRepositoryContract,
} from './helpers/settingsRepositoryContract'

// Each test gets its own database, deleted afterwards, so no test sees another's rows.
let dbCount = 0
const nextDbName = (): string => `dexie-settings-repository-test-${(dbCount += 1)}`

const user = contractUser()
const household = contractHousehold()
const profile = { userId: user.id, householdId: household.id }

describeSettingsRepositoryContract('dexie', async () => {
  const db = openDb(nextDbName())
  await db.users.put(contractUser())
  await db.households.put(contractHousehold())
  return {
    repo: createDexieSettingsRepository(db, profile),
    peekUser: () => db.users.get(user.id),
    peekHousehold: () => db.households.get(household.id),
    writeRawUserPrefs: async (value) => {
      // A raw value the types don't allow, as a damaged or older row might hold it.
      await db.users.update(user.id, { userPrefs: value as UserPrefs })
    },
    writeRawHouseholdPrefs: async (value) => {
      await db.households.update(household.id, { householdPrefs: value as HouseholdPrefs })
    },
    cleanup: () => db.delete(),
  }
})

describe('dexie settings repository', () => {
  let name: string
  let db: ShelfieDB

  beforeEach(() => {
    name = nextDbName()
    db = openDb(name)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('still finds the prefs after the database is closed and opened again', async () => {
    await db.users.put(contractUser())
    await db.households.put(contractHousehold())
    await createDexieSettingsRepository(db, profile).updateUserPrefs({ theme: 'dark' })
    await createDexieSettingsRepository(db, profile).updateHouseholdPrefs({
      reorderDefaultShare: 0.75,
    })
    db.close()

    db = openDb(name)
    const reopened = createDexieSettingsRepository(db, profile)
    expect(await reopened.getUserPrefs()).toEqual({ theme: 'dark' })
    expect(await reopened.getHouseholdPrefs()).toEqual({ reorderDefaultShare: 0.75 })
  })

  it('lets two repository objects on one database see each other’s writes', async () => {
    await db.users.put(contractUser())
    await db.households.put(contractHousehold())
    const first = createDexieSettingsRepository(db, profile)
    const second = createDexieSettingsRepository(db, profile)
    await first.updateUserPrefs({ theme: 'light' })
    expect(await second.getUserPrefs()).toEqual({ theme: 'light' })
    await second.updateHouseholdPrefs({ reorderDefaultShare: 0.5 })
    expect(await first.getHouseholdPrefs()).toEqual({ reorderDefaultShare: 0.5 })
  })

  const methods: Array<[string, (repo: SettingsRepository) => Promise<unknown>]> = [
    ['getUserPrefs', (repo) => repo.getUserPrefs()],
    ['updateUserPrefs', (repo) => repo.updateUserPrefs({ theme: 'dark' })],
    ['getHouseholdPrefs', (repo) => repo.getHouseholdPrefs()],
    ['updateHouseholdPrefs', (repo) => repo.updateHouseholdPrefs({ reorderDefaultShare: 0.5 })],
  ]

  it.each(methods)(
    '%s rejects with a clear error when the user row is missing',
    async (_, call) => {
      await db.households.put(contractHousehold())
      await expect(call(createDexieSettingsRepository(db, profile))).rejects.toThrow(
        `the user row "${user.id}" is missing. Run ensureLocalProfile first.`,
      )
    },
  )

  it.each(methods)(
    '%s rejects with a clear error when the household row is missing',
    async (_, call) => {
      await db.users.put(contractUser())
      await expect(call(createDexieSettingsRepository(db, profile))).rejects.toThrow(
        `the household row "${household.id}" is missing. Run ensureLocalProfile first.`,
      )
    },
  )
})
