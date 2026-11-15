import { useEffect, useState } from 'react'
import { startOfToday } from './domain/dates'
import { createMemoryItemRepository } from './storage/memory-repository'
import { AppShell } from './ui/AppShell'
import { SEED_HOUSEHOLD_ID, seedItems } from './ui/seed'

/**
 * Uses the in-memory repository with invented example items until the app is wired to Dexie
 * (openDb). One repository is created and shared, as repository.ts asks.
 */
export default function App() {
  const [repository] = useState(() =>
    createMemoryItemRepository({ now: () => new Date().toISOString() }),
  )

  useEffect(() => {
    const today = startOfToday(new Date())
    for (const item of seedItems(today)) void repository.put(item)
  }, [repository])

  return <AppShell repository={repository} householdId={SEED_HOUSEHOLD_ID} />
}
