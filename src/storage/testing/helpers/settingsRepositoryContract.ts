// The behaviour every SettingsRepository must have (the rules are in
// src/storage/settings-repository.ts). memory-settings-repository.test.ts and
// dexie-settings-repository.test.ts each run it. Not a *.test.ts file, so it never runs on its
// own. Invented data only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultHouseholdPrefs,
  type Household,
  type HouseholdPrefs,
} from '../../../domain/household'
import { makeHousehold, makeUser } from '../../../domain/testing/helpers/fixtures'
import { defaultUserPrefs, type User, type UserPrefs } from '../../../domain/user'
import type { SettingsRepository } from '../../settings-repository'

/** One fresh settings repository for one test, with ways to read and break its stored rows. */
export interface SettingsContractSubject {
  repo: SettingsRepository
  /** The stored user row, read around the repository (a copy). */
  peekUser(): Promise<User | undefined>
  /** The stored household row, read around the repository (a copy). */
  peekHousehold(): Promise<Household | undefined>
  /** Stores `value` as the user row's userPrefs, as a damaged or older row might hold it. */
  writeRawUserPrefs(value: unknown): Promise<void>
  /** Stores `value` as the household row's householdPrefs. */
  writeRawHouseholdPrefs(value: unknown): Promise<void>
  /** Called after each test, for example to delete the test's database. */
  cleanup(): void | Promise<void>
}

/**
 * The profile rows each version starts from: a new profile with default prefs. The user has
 * sync turned on, with made-up base64 key fields (not real key material), so the tests can show
 * that updates leave the rest of the row alone.
 */
export function contractUser(): User {
  return makeUser({
    syncOn: true,
    keySalt: 'ZXhhbXBsZS1zYWx0',
    kdfParams: { algorithm: 'PBKDF2-SHA256', iterations: 600_000, keyLengthBits: 256 },
    keyCheck: 'ZXhhbXBsZS1jaGVjaw==',
    lastSyncAt: '2026-11-14T08:00:00.000Z',
  })
}

export function contractHousehold(): Household {
  return makeHousehold()
}

/** A change the types don't allow, for the cases that check it is refused at run time. */
const userChange = (value: unknown) => value as Partial<UserPrefs>
const householdChange = (value: unknown) => value as Partial<HouseholdPrefs>

export function describeSettingsRepositoryContract(
  name: string,
  create: () => SettingsContractSubject | Promise<SettingsContractSubject>,
): void {
  describe(`${name}: SettingsRepository contract`, () => {
    let subject: SettingsContractSubject
    let repo: SettingsRepository

    beforeEach(async () => {
      subject = await create()
      repo = subject.repo
    })

    afterEach(async () => {
      vi.restoreAllMocks()
      await subject.cleanup()
    })

    it('gives the default prefs for a new profile', async () => {
      expect(await repo.getUserPrefs()).toEqual(defaultUserPrefs())
      expect(await repo.getHouseholdPrefs()).toEqual(defaultHouseholdPrefs())
    })

    describe('reads are tolerant', () => {
      it.each([
        { case: 'missing', raw: undefined, expected: { theme: 'system' } },
        { case: 'null', raw: null, expected: { theme: 'system' } },
        { case: 'text', raw: 'dark', expected: { theme: 'system' } },
        { case: 'an unknown theme', raw: { theme: 'sepia' }, expected: { theme: 'system' } },
        { case: 'an extra key', raw: { theme: 'dark', font: 'big' }, expected: { theme: 'dark' } },
      ])('user prefs stored as $case read as complete, valid prefs', async ({ raw, expected }) => {
        await subject.writeRawUserPrefs(raw)
        expect(await repo.getUserPrefs()).toEqual(expected)
      })

      it.each([
        { case: 'missing', raw: undefined, expected: 0.9 },
        { case: 'an empty object', raw: {}, expected: 0.9 },
        { case: 'a share as text', raw: { reorderDefaultShare: '0.75' }, expected: 0.9 },
        { case: 'a share of 0', raw: { reorderDefaultShare: 0 }, expected: 0.9 },
        { case: 'an extra key', raw: { reorderDefaultShare: 0.75, x: 1 }, expected: 0.75 },
      ])('household prefs stored as $case read as complete, valid prefs', async (row) => {
        await subject.writeRawHouseholdPrefs(row.raw)
        expect(await repo.getHouseholdPrefs()).toEqual({ reorderDefaultShare: row.expected })
      })
    })

    describe('updates', () => {
      it('change the user prefs, return them, and leave the rest of the row alone', async () => {
        const before = await subject.peekUser()
        const result = await repo.updateUserPrefs({ theme: 'dark' })
        expect(result).toEqual({ theme: 'dark' })
        expect(await repo.getUserPrefs()).toEqual({ theme: 'dark' })
        expect(await subject.peekUser()).toEqual({ ...before, userPrefs: { theme: 'dark' } })
      })

      it('change the household prefs, return them, and leave the rest of the row alone', async () => {
        const before = await subject.peekHousehold()
        const result = await repo.updateHouseholdPrefs({ reorderDefaultShare: 0.75 })
        expect(result).toEqual({ reorderDefaultShare: 0.75 })
        expect(await repo.getHouseholdPrefs()).toEqual({ reorderDefaultShare: 0.75 })
        expect(await subject.peekHousehold()).toEqual({
          ...before,
          householdPrefs: { reorderDefaultShare: 0.75 },
        })
      })

      it('to the same values write nothing and don’t notify', async () => {
        // An extra key in the stored value shows whether the row was written: a write would drop it.
        await subject.writeRawUserPrefs({ theme: 'system', extra: 'kept' })
        await subject.writeRawHouseholdPrefs({ reorderDefaultShare: 0.9, extra: 'kept' })
        const listener = vi.fn()
        repo.subscribe(listener)

        expect(await repo.updateUserPrefs({ theme: 'system' })).toEqual({ theme: 'system' })
        expect(await repo.updateHouseholdPrefs({ reorderDefaultShare: 0.9 })).toEqual({
          reorderDefaultShare: 0.9,
        })
        expect((await subject.peekUser())?.userPrefs).toEqual({ theme: 'system', extra: 'kept' })
        expect((await subject.peekHousehold())?.householdPrefs).toEqual({
          reorderDefaultShare: 0.9,
          extra: 'kept',
        })
        expect(listener).not.toHaveBeenCalled()
      })

      it.each([
        { case: "theme 'sepia'", change: { theme: 'sepia' }, field: 'theme' },
        { case: 'an unknown key', change: { fontSize: 'large' }, field: 'fontSize' },
      ])('to $case are refused and write nothing', async ({ change, field }) => {
        const before = await subject.peekUser()
        const listener = vi.fn()
        repo.subscribe(listener)
        const update = repo.updateUserPrefs(userChange(change))
        await expect(update).rejects.toThrow(RangeError)
        await expect(update).rejects.toThrow(field)
        expect(await subject.peekUser()).toEqual(before)
        expect(listener).not.toHaveBeenCalled()
      })

      it.each([
        { case: 'a share of 0', change: { reorderDefaultShare: 0 }, field: 'reorderDefaultShare' },
        {
          case: 'a share of 1.5',
          change: { reorderDefaultShare: 1.5 },
          field: 'reorderDefaultShare',
        },
        {
          case: 'a share of 0.333',
          change: { reorderDefaultShare: 0.333 },
          field: 'reorderDefaultShare',
        },
        {
          case: 'a share of NaN',
          change: { reorderDefaultShare: Number.NaN },
          field: 'reorderDefaultShare',
        },
        { case: 'an unknown key', change: { currency: 'EUR' }, field: 'currency' },
      ])('to household prefs with $case are refused and write nothing', async (row) => {
        const before = await subject.peekHousehold()
        const listener = vi.fn()
        repo.subscribe(listener)
        const update = repo.updateHouseholdPrefs(householdChange(row.change))
        await expect(update).rejects.toThrow(RangeError)
        await expect(update).rejects.toThrow(row.field)
        expect(await subject.peekHousehold()).toEqual(before)
        expect(listener).not.toHaveBeenCalled()
      })
    })

    it('keeps user and household prefs apart', async () => {
      await repo.updateUserPrefs({ theme: 'dark' })
      expect(await repo.getHouseholdPrefs()).toEqual(defaultHouseholdPrefs())
      await repo.updateHouseholdPrefs({ reorderDefaultShare: 0.5 })
      expect(await repo.getUserPrefs()).toEqual({ theme: 'dark' })
    })

    it('hands out copies: changing a returned prefs object never changes what is stored', async () => {
      const read = await repo.getUserPrefs()
      read.theme = 'dark'
      const updated = await repo.updateHouseholdPrefs({ reorderDefaultShare: 0.75 })
      updated.reorderDefaultShare = 0.1
      const household = await repo.getHouseholdPrefs()
      household.reorderDefaultShare = 0.2

      expect(await repo.getUserPrefs()).toEqual({ theme: 'system' })
      expect(await repo.getHouseholdPrefs()).toEqual({ reorderDefaultShare: 0.75 })
    })

    describe('subscribe', () => {
      it('is called once per update that changed something', async () => {
        const listener = vi.fn()
        repo.subscribe(listener)
        await repo.updateUserPrefs({ theme: 'dark' })
        await repo.updateUserPrefs({ theme: 'dark' }) // no change: no call
        await repo.updateHouseholdPrefs({ reorderDefaultShare: 0.5 })
        expect(listener).toHaveBeenCalledTimes(2)
      })

      it('is called after the update is visible', async () => {
        let seen: Promise<UserPrefs> | undefined
        repo.subscribe(() => {
          seen = repo.getUserPrefs()
        })
        await repo.updateUserPrefs({ theme: 'light' })
        expect(await seen).toEqual({ theme: 'light' })
      })

      it('is not called after unsubscribing', async () => {
        const listener = vi.fn()
        const unsubscribe = repo.subscribe(listener)
        unsubscribe()
        await repo.updateUserPrefs({ theme: 'dark' })
        expect(listener).not.toHaveBeenCalled()
      })

      it('keeps going when a listener throws: the others run and the update succeeds', async () => {
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
        const after = vi.fn()
        repo.subscribe(() => {
          throw new Error('Invented listener failure')
        })
        repo.subscribe(after)

        await expect(repo.updateUserPrefs({ theme: 'dark' })).resolves.toEqual({ theme: 'dark' })
        expect(after).toHaveBeenCalledTimes(1)
        expect(await repo.getUserPrefs()).toEqual({ theme: 'dark' })
        expect(reported).toHaveBeenCalledTimes(1)
      })
    })
  })
}
