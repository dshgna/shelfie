// The state behind AuthProvider: AuthProvider only reads this store (useSyncExternalStore) and
// starts it in an effect, so these are its status transitions.

import { describe, expect, it } from 'vitest'
import { createAuthStore } from '../auth-store'
import type { AuthService, AuthSession } from '../service'

const ALEX: AuthSession = { user: { id: 'user-alex', email: 'alex@example.test' } }
const SAM: AuthSession = { user: { id: 'user-sam', email: 'sam@example.test' } }

/** A fake service whose getSession answer and change events the test controls. */
function fakeService() {
  const listeners = new Set<(session: AuthSession | null) => void>()
  let resolveSession: (session: AuthSession | null) => void = () => {}
  let rejectSession: (error: unknown) => void = () => {}
  let subscribeCount = 0
  const service = {
    getSession: () =>
      new Promise<AuthSession | null>((resolve, reject) => {
        resolveSession = resolve
        rejectSession = reject
      }),
    onAuthStateChange: (callback: (session: AuthSession | null) => void) => {
      subscribeCount += 1
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  } as unknown as AuthService
  return {
    service,
    emit: (session: AuthSession | null) => listeners.forEach((l) => l(session)),
    answer: (session: AuthSession | null) => resolveSession(session),
    fail: () => rejectSession(new Error('invented')),
    listenerCount: () => listeners.size,
    subscribeCount: () => subscribeCount,
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('auth store', () => {
  it('starts loading, then signs in from the stored session', async () => {
    const fake = fakeService()
    const store = createAuthStore(fake.service)
    expect(store.getState()).toEqual({ status: 'loading', user: null })

    store.start()
    fake.answer(ALEX)
    await flush()
    expect(store.getState()).toEqual({ status: 'signedIn', user: ALEX.user })
  })

  it('goes from loading to signed out when there is no session, or getSession fails', async () => {
    const none = fakeService()
    const a = createAuthStore(none.service)
    a.start()
    none.answer(null)
    await flush()
    expect(a.getState().status).toBe('signedOut')

    const failing = fakeService()
    const b = createAuthStore(failing.service)
    b.start()
    failing.fail()
    await flush()
    expect(b.getState().status).toBe('signedOut')
  })

  it('follows sign-in, a switch of account, and sign-out, telling subscribers each time', async () => {
    const fake = fakeService()
    const store = createAuthStore(fake.service)
    const seen: string[] = []
    store.subscribe(() =>
      seen.push(`${store.getState().status}:${store.getState().user?.id ?? '-'}`),
    )
    store.start()
    fake.answer(null)
    await flush()

    fake.emit(ALEX)
    fake.emit(ALEX) // a token refresh: same user, no change
    fake.emit(SAM)
    fake.emit(null)

    expect(seen).toEqual(['signedOut:-', 'signedIn:user-alex', 'signedIn:user-sam', 'signedOut:-'])
  })

  it('keeps the same state object when nothing changed (for useSyncExternalStore)', async () => {
    const fake = fakeService()
    const store = createAuthStore(fake.service)
    store.start()
    fake.emit(ALEX)
    const before = store.getState()
    fake.emit({ user: { ...ALEX.user } })
    expect(store.getState()).toBe(before)
  })

  it('lets a change event win over a late getSession answer', async () => {
    const fake = fakeService()
    const store = createAuthStore(fake.service)
    store.start()
    fake.emit(SAM)
    fake.answer(null)
    await flush()
    expect(store.getState()).toEqual({ status: 'signedIn', user: SAM.user })
  })

  it('subscribes once, and unsubscribes on stop', () => {
    const fake = fakeService()
    const store = createAuthStore(fake.service)
    const stop = store.start()
    store.start()
    expect(fake.subscribeCount()).toBe(1)
    expect(fake.listenerCount()).toBe(1)

    stop()
    expect(fake.listenerCount()).toBe(0)
  })

  it('ignores an answer that arrives after stop, and can start again (StrictMode)', async () => {
    const fake = fakeService()
    const store = createAuthStore(fake.service)
    const stop = store.start()
    stop()
    fake.answer(ALEX)
    await flush()
    expect(store.getState().status).toBe('loading')

    store.start()
    expect(fake.listenerCount()).toBe(1)
    fake.answer(SAM)
    await flush()
    expect(store.getState()).toEqual({ status: 'signedIn', user: SAM.user })
  })
})
