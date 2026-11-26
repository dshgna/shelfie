// The signed-in state, outside React so it can be tested without a DOM. AuthProvider reads it with
// useSyncExternalStore and starts it in an effect.

import type { AuthService, AuthSession, AuthUser } from './service'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: AuthUser }

export const LOADING: AuthState = { status: 'loading', user: null }
const SIGNED_OUT: AuthState = { status: 'signedOut', user: null }

export interface AuthStore {
  getState(): AuthState
  subscribe(listener: () => void): () => void
  /**
   * Subscribes to the service once and asks for the current session. Calling it again while
   * started does nothing. Returns `stop`, which unsubscribes (React StrictMode stops and starts
   * effects once in development, so it can be started again after stopping).
   */
  start(): () => void
}

function sameState(a: AuthState, b: AuthState): boolean {
  return a.status === b.status && a.user?.id === b.user?.id && a.user?.email === b.user?.email
}

export function createAuthStore(service: AuthService): AuthStore {
  let state: AuthState = LOADING
  const listeners = new Set<() => void>()
  let unsubscribe: (() => void) | null = null
  // Bumped on every start and stop, so an answer from an earlier start is ignored.
  let run = 0

  const set = (session: AuthSession | null) => {
    const next: AuthState = session ? { status: 'signedIn', user: session.user } : SIGNED_OUT
    if (sameState(state, next)) return
    state = next
    for (const listener of listeners) listener()
  }

  const stop = () => {
    run += 1
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (unsubscribe) return stop
      run += 1
      const thisRun = run
      // A change event is newer than the getSession answer, so once one arrives the answer is ignored.
      let heardChange = false
      unsubscribe = service.onAuthStateChange((session) => {
        heardChange = true
        set(session)
      })
      service.getSession().then(
        (session) => {
          if (thisRun === run && !heardChange) set(session)
        },
        () => {
          if (thisRun === run && !heardChange) set(null)
        },
      )
      return stop
    },
  }
}
