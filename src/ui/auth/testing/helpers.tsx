// Test helpers for the sign-in screens: a fake AuthService (every method a vi.fn, with invented
// data only) and a render function that wraps the screen in AuthProvider.

import { cleanup, render, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, vi } from 'vitest'
import { AuthProvider } from '../../../auth/AuthProvider'
import type { AuthService, AuthSession } from '../../../auth/service'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

export const ALEX: AuthSession = { user: { id: 'user-alex', email: 'alex@example.test' } }

export function fakeAuthService(session: AuthSession | null = null) {
  const listeners = new Set<(s: AuthSession | null) => void>()
  const emit = (s: AuthSession | null) => listeners.forEach((l) => l(s))
  const service = {
    signUp: vi.fn(async () => ({ needsConfirmation: true })),
    resendConfirmation: vi.fn(async () => {}),
    signIn: vi.fn(async () => ALEX),
    signOut: vi.fn(async () => emit(null)),
    signOutOthers: vi.fn(async () => {}),
    requestPasswordReset: vi.fn(async () => {}),
    confirmPassword: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {}),
    updateEmail: vi.fn(async () => {}),
    getSession: vi.fn(async () => session),
    onAuthStateChange: vi.fn((callback: (s: AuthSession | null) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    deleteAccount: vi.fn(async (): Promise<never> => {
      throw new Error('Deleting an account is not available yet.')
    }),
  } satisfies AuthService
  return { service, emit }
}

export function renderWithAuth(
  ui: ReactNode,
  service: AuthService = fakeAuthService().service,
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup()
  return { user, ...render(<AuthProvider service={service}>{ui}</AuthProvider>) }
}

/** Makes useWide() true or false, as a 1280px or 390px window would. */
export function setWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
