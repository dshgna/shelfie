// The signed-in state, outside React so it can be tested without a DOM. AuthProvider reads it with
// useSyncExternalStore and starts it in an effect.

import { ConfigurationError } from './errors'
import type { AuthService, AuthSession, AuthUser } from './service'

/**
 * 'unavailable': this build can't reach Supabase at all (a missing VITE_ variable). Showing the
 * sign-in screens then would only fail on submit, so the app shows a plain "can't start" screen.
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unavailable'

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: AuthUser }
  | { status: 'unavailable'; user: null }

export const LOADING: AuthState = { status: 'loading', user: null }
const SIGNED_OUT: AuthState = { status: 'signedOut', user: null }
const UNAVAILABLE: AuthState = { status: 'unavailable', user: null }

/** For the owner, in DevTools: the variable's name only, never a value. */
function reportMissingConfiguration(error: ConfigurationError) {
  console.error(
    `Shelfie can't start: ${error.variable} was not set when this build was made. Set it in the build environment and deploy again.`,
  )
}

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

  const setState = (next: AuthState) => {
    if (sameState(state, next)) return
    state = next
    for (const listener of listeners) listener()
  }
  const set = (session: AuthSession | null) =>
    setState(session ? { status: 'signedIn', user: session.user } : SIGNED_OUT)
  const unavailable = (error: ConfigurationError) => {
    reportMissingConfiguration(error)
    setState(UNAVAILABLE)
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
      try {
        unsubscribe = service.onAuthStateChange((session) => {
          heardChange = true
          set(session)
        })
      } catch (error) {
        // Never thrown at startup: a missing configuration becomes the 'unavailable' state.
        if (error instanceof ConfigurationError) unavailable(error)
        else setState(SIGNED_OUT)
        return stop
      }
      service.getSession().then(
        (session) => {
          if (thisRun === run && !heardChange) set(session)
        },
        (error: unknown) => {
          if (thisRun !== run || heardChange) return
          if (error instanceof ConfigurationError) unavailable(error)
          else set(null)
        },
      )
      return stop
    },
  }
}
