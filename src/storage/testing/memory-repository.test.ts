import type { Item } from '../../domain/item'
import { createMemoryItemRepository } from '../memory-repository'
import { describeItemRepositoryContract } from './helpers/itemRepositoryContract'

describeItemRepositoryContract('memory', () => {
  let current = ''
  const store = new Map<string, Item>()
  return {
    repo: createMemoryItemRepository({ now: () => current, store }),
    setNow: (iso) => {
      current = iso
    },
    peek: async (id) => {
      const row = store.get(id)
      return row && structuredClone(row)
    },
    cleanup: () => {},
  }
})
