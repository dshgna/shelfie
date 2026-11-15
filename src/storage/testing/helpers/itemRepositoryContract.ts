// The behaviour every ItemRepository must have (the rules are in src/storage/repository.ts).
// memory-repository.test.ts and dexie-repository.test.ts each run it, so both versions are held to
// the same cases. Not a *.test.ts file, so it never runs on its own. Invented data only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../../../domain/item'
import { NOW, makeItem } from '../../../domain/testing/helpers/fixtures'
import { ItemHouseholdMismatchError, type ItemRepository } from '../../repository'

/** One fresh repository for one test, with a clock the test controls. */
export interface ContractSubject {
  repo: ItemRepository
  /** What the repository's clock returns from now on (any text, so tests can break it). */
  setNow(iso: string): void
  /** The stored row, deleted or not, read around the repository (a copy). */
  peek(id: string): Promise<Item | undefined>
  /** Called after each test, for example to delete the test's database. */
  cleanup(): void | Promise<void>
}

// Three moments, in order. T1 is the fixtures' NOW, which makeItem() also uses as its updatedAt.
const T1 = NOW
const T2 = '2026-11-14T10:00:00.000Z'
const T3 = '2026-11-14T11:00:00.000Z'

const idsOf = (items: Item[]): string[] => items.map((item) => item.id).sort()

export function describeItemRepositoryContract(
  name: string,
  create: () => ContractSubject | Promise<ContractSubject>,
): void {
  describe(`${name}: ItemRepository contract`, () => {
    let subject: ContractSubject
    let repo: ItemRepository

    beforeEach(async () => {
      subject = await create()
      repo = subject.repo
      subject.setNow(T1)
    })

    afterEach(async () => {
      vi.restoreAllMocks()
      await subject.cleanup()
    })

    describe('list', () => {
      it("returns only that household's items, without deleted ones", async () => {
        await repo.put(makeItem({ id: 'a', householdId: 'home' }))
        await repo.put(makeItem({ id: 'b', householdId: 'cabin' }))
        await repo.put(makeItem({ id: 'c', householdId: 'home' }))
        await repo.put(makeItem({ id: 'd', householdId: 'home' }))
        await repo.remove('d')
        expect(idsOf(await repo.list('home'))).toEqual(['a', 'c'])
        expect(idsOf(await repo.list('cabin'))).toEqual(['b'])
      })

      it('returns [] for an unknown household', async () => {
        await repo.put(makeItem({ id: 'a', householdId: 'home' }))
        expect(await repo.list('nowhere')).toEqual([])
      })
    })

    describe('get', () => {
      it('returns the stored item', async () => {
        const saved = await repo.put(makeItem({ id: 'a' }))
        expect(await repo.get('a')).toEqual(saved)
      })

      it('returns undefined for a missing id and for a deleted item', async () => {
        await repo.put(makeItem({ id: 'a' }))
        await repo.remove('a')
        expect(await repo.get('missing')).toBeUndefined()
        expect(await repo.get('a')).toBeUndefined()
      })
    })

    describe('put', () => {
      it('stores a new item with updatedAt from the clock, whatever the item says', async () => {
        subject.setNow(T2)
        const input = makeItem({ id: 'a' }) // its updatedAt is T1
        const saved = await repo.put(input)
        expect(saved).toEqual({ ...input, updatedAt: T2 })
        expect(await repo.get('a')).toEqual(saved)
      })

      it('replaces an existing item and moves updatedAt to the new clock value', async () => {
        const first = await repo.put(makeItem({ id: 'a', name: 'Lemon Soap' }))
        subject.setNow(T3)
        await repo.put({ ...first, name: 'Lime Soap' })
        const stored = await repo.get('a')
        expect(stored).toMatchObject({ name: 'Lime Soap', updatedAt: T3 })
        expect(await repo.list(first.householdId)).toHaveLength(1)
      })

      it('leaves the object passed in unchanged', async () => {
        subject.setNow(T2)
        const input = Object.freeze(makeItem({ id: 'a' })) // frozen: any change to it would throw
        const before = structuredClone(input)
        await repo.put(input)
        expect(input).toEqual(before)
        expect(input.updatedAt).toBe(T1)
      })

      it('hands out copies: changing an object in or out never changes what is stored', async () => {
        const input = makeItem({ id: 'a', name: 'Lemon Soap', links: {} })
        const saved = await repo.put(input)
        input.name = 'Changed after put'
        saved.name = 'Changed result'
        saved.links.product = 'https://example.com/changed'
        const [listed] = await repo.list(input.householdId)
        if (listed) listed.name = 'Changed list entry'
        const got = await repo.get('a')
        if (got) got.reorder = { kind: 'count', atOrBelow: 9 }

        const stored = await repo.get('a')
        expect(stored).toMatchObject({ name: 'Lemon Soap', links: {} })
        expect(stored?.reorder).toEqual(makeItem().reorder)
      })

      it('restores a removed item when put with deleted: false', async () => {
        const item = makeItem({ id: 'a' })
        await repo.put(item)
        await repo.remove('a')
        subject.setNow(T3)
        await repo.put({ ...item, deleted: false })
        expect(await repo.get('a')).toMatchObject({ id: 'a', deleted: false, updatedAt: T3 })
        expect(idsOf(await repo.list(item.householdId))).toEqual(['a'])
      })

      it('refuses to move an item to another household, and changes nothing', async () => {
        const saved = await repo.put(makeItem({ id: 'a', householdId: 'home' }))
        const listener = vi.fn()
        repo.subscribe(listener)
        subject.setNow(T2)
        await expect(repo.put(makeItem({ id: 'a', householdId: 'cabin' }))).rejects.toThrow(
          ItemHouseholdMismatchError,
        )
        expect(await subject.peek('a')).toEqual(saved)
        expect(await repo.list('cabin')).toEqual([])
        expect(listener).not.toHaveBeenCalled()
      })

      it('refuses the move when the stored item is deleted, too', async () => {
        await repo.put(makeItem({ id: 'a', householdId: 'home' }))
        subject.setNow(T2)
        await repo.remove('a')
        const removed = await subject.peek('a')
        const listener = vi.fn()
        repo.subscribe(listener)
        subject.setNow(T3)
        await expect(repo.put(makeItem({ id: 'a', householdId: 'cabin' }))).rejects.toThrow(
          ItemHouseholdMismatchError,
        )
        expect(await subject.peek('a')).toEqual(removed)
        expect(listener).not.toHaveBeenCalled()
      })

      it('still saves an item with the same id in the same household', async () => {
        await repo.put(makeItem({ id: 'a', householdId: 'home', name: 'Lemon Soap' }))
        subject.setNow(T2)
        await repo.put(makeItem({ id: 'a', householdId: 'home', name: 'Lime Soap' }))
        expect(await repo.get('a')).toMatchObject({ name: 'Lime Soap', updatedAt: T2 })
      })
    })

    describe('remove', () => {
      it('keeps the row, marked deleted, with updatedAt moved to the clock', async () => {
        const saved = await repo.put(makeItem({ id: 'a' }))
        subject.setNow(T2)
        await repo.remove('a')
        expect(await subject.peek('a')).toEqual({ ...saved, deleted: true, updatedAt: T2 })
      })

      it('leaves an already-deleted item’s updatedAt as it was, and doesn’t notify', async () => {
        await repo.put(makeItem({ id: 'a' }))
        subject.setNow(T2)
        await repo.remove('a')
        const listener = vi.fn()
        repo.subscribe(listener)
        subject.setNow(T3)
        await repo.remove('a')
        expect(await subject.peek('a')).toMatchObject({ deleted: true, updatedAt: T2 })
        expect(listener).not.toHaveBeenCalled()
      })

      it('hides the item from list and get, and a put brings it back', async () => {
        const item = makeItem({ id: 'a' })
        await repo.put(item)
        subject.setNow(T2)
        await repo.remove('a')
        expect(await repo.get('a')).toBeUndefined()
        expect(await repo.list(item.householdId)).toEqual([])

        await repo.put(item)
        expect(await repo.get('a')).toBeDefined()
      })

      it('does nothing for a missing or already-deleted id, and doesn’t notify', async () => {
        await repo.put(makeItem({ id: 'a' }))
        await repo.remove('a')
        const listener = vi.fn()
        repo.subscribe(listener)

        await expect(repo.remove('missing')).resolves.toBeUndefined()
        await expect(repo.remove('a')).resolves.toBeUndefined()
        expect(listener).not.toHaveBeenCalled()
        expect(await repo.get('missing')).toBeUndefined()
        expect(await repo.get('a')).toBeUndefined()
      })
    })

    describe('a clock that gives an invalid value', () => {
      it.each(['not a time', '2026-02-30T09:30:00.000Z', '2026-11-14T09:30:00Z'])(
        'makes put reject and store nothing (%s)',
        async (bad) => {
          const listener = vi.fn()
          repo.subscribe(listener)
          subject.setNow(bad)
          await expect(repo.put(makeItem({ id: 'a' }))).rejects.toThrow(RangeError)
          expect(await repo.get('a')).toBeUndefined()
          expect(await repo.list(makeItem().householdId)).toEqual([])
          expect(listener).not.toHaveBeenCalled()
        },
      )

      it('makes remove reject even for an id that doesn’t exist', async () => {
        const listener = vi.fn()
        repo.subscribe(listener)
        subject.setNow('not a time')
        await expect(repo.remove('missing')).rejects.toThrow(RangeError)
        expect(await subject.peek('missing')).toBeUndefined()
        expect(listener).not.toHaveBeenCalled()
      })

      it('makes remove reject and change nothing', async () => {
        const saved = await repo.put(makeItem({ id: 'a' }))
        const listener = vi.fn()
        repo.subscribe(listener)
        subject.setNow('not a time')
        await expect(repo.remove('a')).rejects.toThrow(RangeError)
        expect(await repo.get('a')).toEqual(saved)
        expect(listener).not.toHaveBeenCalled()
      })
    })

    describe('subscribe', () => {
      it('calls the listener once per put and once per remove that changed something', async () => {
        const listener = vi.fn()
        repo.subscribe(listener)
        await repo.put(makeItem({ id: 'a' }))
        await repo.put(makeItem({ id: 'b' }))
        await repo.remove('a')
        await repo.remove('a') // already deleted: no call
        expect(listener).toHaveBeenCalledTimes(3)
      })

      it('calls the listener after the write is visible', async () => {
        let seen: Promise<Item | undefined> | undefined
        repo.subscribe(() => {
          seen = repo.get('a')
        })

        await repo.put(makeItem({ id: 'a', name: 'Lemon Soap' }))
        expect(await seen).toMatchObject({ name: 'Lemon Soap' })

        await repo.remove('a')
        expect(await seen).toBeUndefined()
      })

      it('stops calling the listener once unsubscribed; unsubscribing twice is harmless', async () => {
        const listener = vi.fn()
        const unsubscribe = repo.subscribe(listener)
        await repo.put(makeItem({ id: 'a' }))
        unsubscribe()
        unsubscribe()
        await repo.put(makeItem({ id: 'b' }))
        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('runs every listener', async () => {
        const first = vi.fn()
        const second = vi.fn()
        repo.subscribe(first)
        repo.subscribe(second)
        await repo.put(makeItem({ id: 'a' }))
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
      })

      it('keeps going when a listener throws: the others run and the write succeeds', async () => {
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
        const after = vi.fn()
        repo.subscribe(() => {
          throw new Error('Invented listener failure')
        })
        repo.subscribe(after)

        await expect(repo.put(makeItem({ id: 'a' }))).resolves.toMatchObject({ id: 'a' })
        expect(after).toHaveBeenCalledTimes(1)
        expect(await repo.get('a')).toBeDefined()
        expect(reported).toHaveBeenCalledTimes(1)
      })
    })
  })
}
