// Guards the shared test data: src/domain/testing/ (the domain tests and their helpers) may only
// be imported by test code (test files, and the helpers in src/domain/testing/ and
// src/storage/testing/), so it can never end up in the app bundle. Lives outside src/domain
// because it reads files (node:fs), which domain code may not do.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = new URL('.', import.meta.url).pathname
const TESTING_DIR = join(SRC, 'domain', 'testing')
// Test helpers that aren't *.test.ts files themselves, such as the repository contract.
const TEST_CODE_DIRS = [TESTING_DIR, join(SRC, 'storage', 'testing')]
// An import of anything in testing/ from outside it ('../domain/testing/helpers/fixtures'), or of
// the fixtures from the tests next to them ('./helpers/fixtures').
const IMPORT_OF_TESTING = /from\s+['"][^'"]*(\/testing(\/[^'"]*)?|\/helpers\/fixtures)['"]/

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
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => !TEST_CODE_DIRS.some((dir) => file.startsWith(dir + '/')))
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
