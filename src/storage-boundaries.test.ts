// The repository interfaces and the in-memory repositories must never use IndexedDB, so the UI and
// tests can run on them without a database. They live in src/storage, where ESLint allows Dexie,
// so this test checks them instead. Lives in src/ because it reads files (node:fs), like the other
// file-reading tests.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')

/** An import, re-export, dynamic import or require of 'dexie' or 'fake-indexeddb'. */
const INDEXEDDB_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:dexie|fake-indexeddb)(?:\/[^'"]*)?['"]/

const DEXIE_FREE = [
  './storage/repository.ts',
  './storage/memory-repository.ts',
  './storage/settings-repository.ts',
  './storage/memory-settings-repository.ts',
]

describe('storage boundaries', () => {
  it.each(DEXIE_FREE)('%s does not import Dexie or fake-indexeddb', (path) => {
    expect(read(path)).not.toMatch(INDEXEDDB_IMPORT)
  })

  it('recognises a Dexie import (so the check above is looking for the right thing)', () => {
    expect(read('./storage/db.ts')).toMatch(INDEXEDDB_IMPORT)
  })
})
