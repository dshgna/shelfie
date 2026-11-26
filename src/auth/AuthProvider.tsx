import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createAuthStore } from './auth-store'
import type { AuthService } from './service'
import { AuthContext, type AuthContextValue } from './useAuth'

/** Gives the app the signed-in state and the account actions (read them with useAuth). */
export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [store] = useState(() => createAuthStore(service))
  // Subscribes once to the service's auth changes and unsubscribes on unmount.
  useEffect(() => store.start(), [store])
  const state = useSyncExternalStore(store.subscribe, store.getState)

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      signUp: service.signUp,
      resendConfirmation: service.resendConfirmation,
      signIn: service.signIn,
      signOut: service.signOut,
      signOutOthers: service.signOutOthers,
      requestPasswordReset: service.requestPasswordReset,
      confirmPassword: service.confirmPassword,
      updatePassword: service.updatePassword,
      updateEmail: service.updateEmail,
      deleteAccount: service.deleteAccount,
    }),
    [state, service],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
