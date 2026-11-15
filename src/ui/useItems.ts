import { useEffect, useState } from 'react'
import type { Item } from '../domain/item'
import type { ItemRepository } from '../storage/repository'

/** The household's items, reloaded after every change saved through `repository`. */
export function useItems(repository: ItemRepository, householdId: string): Item[] {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    let active = true
    const load = () => {
      void repository.list(householdId).then((list) => {
        if (active) setItems(list)
      })
    }
    load()
    const stop = repository.subscribe(load)
    return () => {
      active = false
      stop()
    }
  }, [repository, householdId])

  return items
}
