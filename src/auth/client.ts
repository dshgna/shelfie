// The Supabase client for the app. It reads only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// (both public by design; CLAUDE.md privacy rule 4). Vite fills them in at build time. The client
// is created on the first auth call (the service asks for it lazily), never at import or startup,
// so a build without them throws a ConfigurationError there, which the app shows as its plain
// "can't start" screen instead of a blank page.
//
// "Keep me signed in": Supabase keeps the session in the storage given here. When the choice is on
// (the default) that is localStorage, so the session survives closing the app; when it is off it
// is sessionStorage, so the session ends when the tab or app closes. The choice is a small,
// non-sensitive setting in localStorage, so the next start knows where to look for the session.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ConfigurationError } from './errors'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

/** The two values the app needs, or an error that names the missing variable. */
export function readSupabaseConfig(env: {
  VITE_SUPABASE_URL?: string | undefined
  VITE_SUPABASE_ANON_KEY?: string | undefined
}): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url) throw new ConfigurationError('VITE_SUPABASE_URL')
  if (!anonKey) throw new ConfigurationError('VITE_SUPABASE_ANON_KEY')
  return { url, anonKey }
}

/** The part of the Web Storage API used here, so tests can pass a fake. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The localStorage key of the "Keep me signed in" choice: '1' on, '0' off. Not sensitive. */
export const KEEP_SIGNED_IN_KEY = 'shelfie.keepSignedIn'

export interface SessionStorageSwitch {
  /** The storage Supabase is given. Reads and writes go to whichever store the choice points at. */
  storage: KeyValueStorage
  keepSignedIn(): boolean
  /** Call before signing in. Remembers the choice; the session is written where it points. */
  setKeepSignedIn(keep: boolean): void
}

/**
 * Storage for the Supabase session that follows "Keep me signed in". Writing a key also removes it
 * from the other store, so a session never lingers where the person didn't ask for it.
 */
export function createSessionStorageSwitch(stores: {
  local: KeyValueStorage
  session: KeyValueStorage
}): SessionStorageSwitch {
  const keepSignedIn = (): boolean => stores.local.getItem(KEEP_SIGNED_IN_KEY) !== '0'
  const current = () => (keepSignedIn() ? stores.local : stores.session)
  const other = () => (keepSignedIn() ? stores.session : stores.local)
  return {
    storage: {
      getItem: (key) => current().getItem(key),
      setItem: (key, value) => {
        current().setItem(key, value)
        other().removeItem(key)
      },
      removeItem: (key) => {
        stores.local.removeItem(key)
        stores.session.removeItem(key)
      },
    },
    keepSignedIn,
    setKeepSignedIn: (keep) => stores.local.setItem(KEEP_SIGNED_IN_KEY, keep ? '1' : '0'),
  }
}

let sessionSwitch: SessionStorageSwitch | undefined
let client: SupabaseClient | undefined

function browserSessionSwitch(): SessionStorageSwitch {
  sessionSwitch ??= createSessionStorageSwitch({
    local: window.localStorage,
    session: window.sessionStorage,
  })
  return sessionSwitch
}

/** Chooses where the next sign-in keeps its session. */
export function setKeepSignedIn(keep: boolean): void {
  browserSessionSwitch().setKeepSignedIn(keep)
}

/** The app's one Supabase client, created on first call. Throws ConfigurationError if a variable is missing. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client
  const { url, anonKey } = readSupabaseConfig({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  })
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: browserSessionSwitch().storage,
    },
  })
  return client
}
