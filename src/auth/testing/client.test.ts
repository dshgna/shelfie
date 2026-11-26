import { describe, expect, it } from 'vitest'
import {
  KEEP_SIGNED_IN_KEY,
  createSessionStorageSwitch,
  readSupabaseConfig,
  type KeyValueStorage,
} from '../client'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const TOKEN_KEY = 'sb-invented-auth-token'

describe('readSupabaseConfig', () => {
  it('returns both values', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://invented.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'invented-anon-key',
      }),
    ).toEqual({ url: 'https://invented.supabase.co', anonKey: 'invented-anon-key' })
  })

  it('names the missing variable', () => {
    expect(() => readSupabaseConfig({ VITE_SUPABASE_ANON_KEY: 'k' })).toThrow(/VITE_SUPABASE_URL/)
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://invented.supabase.co',
        VITE_SUPABASE_ANON_KEY: ' ',
      }),
    ).toThrow(/VITE_SUPABASE_ANON_KEY/)
  })
})

describe('createSessionStorageSwitch ("Keep me signed in")', () => {
  it('keeps the session in localStorage by default', () => {
    const local = memoryStorage()
    const session = memoryStorage()
    const sw = createSessionStorageSwitch({ local, session })

    expect(sw.keepSignedIn()).toBe(true)
    sw.storage.setItem(TOKEN_KEY, 'invented-session')
    expect(local.data.get(TOKEN_KEY)).toBe('invented-session')
    expect(session.data.has(TOKEN_KEY)).toBe(false)
  })

  it('keeps it in sessionStorage when the choice is off, and remembers the choice', () => {
    const local = memoryStorage()
    const session = memoryStorage()
    createSessionStorageSwitch({ local, session }).setKeepSignedIn(false)

    // A new start reads the remembered choice.
    const sw = createSessionStorageSwitch({ local, session })
    expect(local.data.get(KEEP_SIGNED_IN_KEY)).toBe('0')
    expect(sw.keepSignedIn()).toBe(false)
    sw.storage.setItem(TOKEN_KEY, 'invented-session')
    expect(session.data.get(TOKEN_KEY)).toBe('invented-session')
    expect(local.data.has(TOKEN_KEY)).toBe(false)
    expect(sw.storage.getItem(TOKEN_KEY)).toBe('invented-session')
  })

  it('moves the session when the choice changes, and removes it from both on sign-out', () => {
    const local = memoryStorage()
    const session = memoryStorage()
    const sw = createSessionStorageSwitch({ local, session })
    sw.storage.setItem(TOKEN_KEY, 'first')

    sw.setKeepSignedIn(false)
    sw.storage.setItem(TOKEN_KEY, 'second')
    expect(local.data.has(TOKEN_KEY)).toBe(false)
    expect(session.data.get(TOKEN_KEY)).toBe('second')

    sw.storage.removeItem(TOKEN_KEY)
    expect(local.data.has(TOKEN_KEY)).toBe(false)
    expect(session.data.has(TOKEN_KEY)).toBe(false)
  })

  it('stores nothing sensitive in the choice itself', () => {
    const local = memoryStorage()
    const sw = createSessionStorageSwitch({ local, session: memoryStorage() })
    sw.setKeepSignedIn(true)
    expect([...local.data.entries()]).toEqual([[KEEP_SIGNED_IN_KEY, '1']])
  })
})
