import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NOW, makeItem } from '../../domain/testing/helpers/fixtures'
import { openDb, type ShelfieDB } from '../db'
import { createDexieItemRepository } from '../dexie-repository'
import { describeItemRepositoryContract } from './helpers/itemRepositoryContract'

// Each test gets its own database, deleted afterwards, so no test sees another's rows.
let dbCount = 0
const nextDbName = (): string => `dexie-repository-test-${(dbCount += 1)}`

describeItemRepositoryContract('dexie', () => {
  const db = openDb(nextDbName())
  let current = ''
  return {
    repo: createDexieItemRepository(db, { now: () => current }),
    setNow: (iso) => {
      current = iso
    },
    peek: (id) => db.items.get(id),
    cleanup: () => db.delete(),
  }
})

describe('dexie item repository', () => {
  let db: ShelfieDB

  beforeEach(() => {
    db = openDb(nextDbName())
  })

  afterEach(async () => {
    await db.delete()
  })

  it('lets two repositories on the same database see each other’s writes', async () => {
    const first = createDexieItemRepository(db, { now: () => NOW })
    const second = createDexieItemRepository(db, { now: () => NOW })
    const saved = await first.put(makeItem({ id: 'a' }))
    expect(await second.get('a')).toEqual(saved)
    await second.remove('a')
    expect(await first.get('a')).toBeUndefined()
  })
})
