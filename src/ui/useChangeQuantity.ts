import { useCallback, useRef } from 'react'
import { CURRENT_SCHEMA_VERSION } from '../domain/item'
import { normalizeItem, validateItem } from '../domain/validate'
import type { ItemRepository } from '../storage/repository'

/**
 * Returns a function that adds `delta` (one more, one fewer, or the number bought) to an item's
 * quantity, never below 0, and saves it through the repository. It resolves to true when the
 * change was saved (or there was nothing to change) and false when it couldn't be. Following
 * repository.ts:
 * - it reads the stored item fresh, so it never saves over a newer copy with a stale one;
 * - it keeps `schemaVersion` as stored and refuses to write an item whose schema version is not
 *   CURRENT_SCHEMA_VERSION;
 * - it runs normalizeItem (which clears the start date when none are left) and validateItem
 *   first, because `put` doesn't validate;
 * - `put` stamps `updatedAt` from the clock.
 * Changes run one after another, so two quick presses never read the same starting quantity.
 */
export function useChangeQuantity(repository: ItemRepository) {
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  return useCallback(
    (id: string, delta: number): Promise<boolean> => {
      const run = queue.current.then(async () => {
        const item = await repository.get(id)
        if (!item) return true
        const quantity = Math.max(0, item.quantity + delta)
        if (quantity === item.quantity) return true
        if (item.schemaVersion !== CURRENT_SCHEMA_VERSION) {
          throw new Error(
            `item ${id} has schema version ${item.schemaVersion}, expected ${CURRENT_SCHEMA_VERSION}`,
          )
        }
        const next = normalizeItem({ ...item, quantity })
        const issues = validateItem(next)
        if (issues.length > 0) {
          throw new Error(`item ${id} is not valid: ${issues.map((i) => i.code).join(', ')}`)
        }
        await repository.put(next)
        return true
      })
      const settled = run.catch((error: unknown) => {
        console.error('Shelfie: could not change the quantity', error)
        return false
      })
      queue.current = settled
      return settled
    },
    [repository],
  )
}
