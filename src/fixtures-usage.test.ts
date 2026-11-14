// Guards the shared test data: src/domain/testing/ may only be imported by test files, so it can
// never end up in the app bundle. Lives outside src/domain because it reads files (node:fs),
// which domain code may not do.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = new URL('.', import.meta.url).pathname
const TESTING_DIR = join(SRC, 'domain', 'testing')
const IMPORT_OF_TESTING = /from\s+['"][^'"]*\/testing(\/[^'"]*)?['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe('test fixtures', () => {
  it('are imported only by test files', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !/\.test\.tsx?$/.test(file) && !file.startsWith(TESTING_DIR))
      .filter((file) => IMPORT_OF_TESTING.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('are actually used by tests (so the check above is looking at the right path)', () => {
    const users = sourceFiles(SRC).filter(
      (file) => /\.test\.ts$/.test(file) && IMPORT_OF_TESTING.test(readFileSync(file, 'utf8')),
    )
    expect(users.length).toBeGreaterThan(0)
  })
})
