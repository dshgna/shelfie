import { createContext, useContext } from 'react'
import type { AuthStatus } from './auth-store'
import type { AuthService, AuthUser } from './service'

/** The account actions the UI may call. Session reading and subscribing stay inside AuthProvider. */
export type AuthActions = Omit<AuthService, 'getSession' | 'onAuthStateChange'>

export interface AuthContextValue extends AuthActions {
  status: AuthStatus
  /** Set only when status is 'signedIn'. */
  user: AuthUser | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.')
  return value
}
