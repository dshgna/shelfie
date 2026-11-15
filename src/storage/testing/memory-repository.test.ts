import 'fake-indexeddb/auto'
import type { Item } from '../../domain/item'
import type { ItemPurchaseRecord } from '../../domain/item-purchase-record'
import { createMemoryItemRepository } from '../memory-repository'
import { describeItemRepositoryContract } from './helpers/itemRepositoryContract'

describeItemRepositoryContract('memory', () => {
  let current = ''
  const store = new Map<string, Item>()
  const purchases = new Map<string, ItemPurchaseRecord>()
  return {
    repo: createMemoryItemRepository({ now: () => current, store, purchases }),
    setNow: (iso) => {
      current = iso
    },
    peek: async (id) => {
      const row = store.get(id)
      return row && structuredClone(row)
    },
    peekPurchase: async (id) => {
      const row = purchases.get(id)
      return row && structuredClone(row)
    },
    cleanup: () => {},
  }
})
