// The account layer: email and password through Supabase Auth. An account is required to use
// Shelfie (there is no guest mode). The UI uses AuthService through useAuth(), never Supabase
// directly, so the screens and tests can run on a fake.
//
// Rules:
// - Every failure is thrown as an AuthFailure with a Shelfie code (errors.ts). Raw Supabase errors
//   and auth responses are never logged, shown or kept.
// - Only the user's id and email leave this file; tokens stay inside the Supabase client.
// - The account password is never used to derive an encryption key (docs/decisions.md, Open
//   questions).

import { AuthFailure, ConfigurationError, toAuthFailure } from './errors'
import { validatePassword } from './password'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  user: AuthUser
}

export interface AuthService {
  /** Creates the account. `needsConfirmation` is true when Supabase sent a confirmation email first. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>
  /** Sends the sign-up confirmation email again. */
  resendConfirmation(email: string): Promise<void>
  /** `keepSignedIn` off keeps the session only until the app closes (client.ts). */
  signIn(email: string, password: string, keepSignedIn: boolean): Promise<AuthSession>
  /** Signs out on this device only. Local data stays on the device. */
  signOut(): Promise<void>
  /** Signs out every other device, keeping this one signed in. */
  signOutOthers(): Promise<void>
  /** Emails a reset link that opens the app at /app/reset-password/. Says nothing about whether the account exists. */
  requestPasswordReset(email: string): Promise<void>
  /**
   * Signs in again as the current account, for a change that needs a recent sign-in. Keeps the
   * "Keep me signed in" choice as it is.
   */
  confirmPassword(password: string): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  /** Supabase emails a confirmation link; the email changes once it is opened. */
  updateEmail(newEmail: string): Promise<void>
  getSession(): Promise<AuthSession | null>
  /** Calls back with the new session (or null) on every change. Returns the unsubscribe function. */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
  /** Needs a server function; a later step. */
  deleteAccount(): Promise<never>
}

/** The session fields Shelfie reads. Supabase's Session has many more; they are ignored. */
interface SessionLike {
  user: { id: string; email?: string | undefined }
}

/**
 * The part of Supabase's `client.auth` used here, typed loosely so a test can pass a fake.
 * The real client's `auth` satisfies it.
 */
export interface SupabaseAuthApi {
  signUp(credentials: {
    email: string
    password: string
    options?: { emailRedirectTo?: string }
  }): Promise<{ data: { session: SessionLike | null }; error: unknown }>
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ data: { session: SessionLike | null }; error: unknown }>
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: unknown }>
  resetPasswordForEmail(
    email: string,
    options?: { redirectTo?: string },
  ): Promise<{ error: unknown }>
  updateUser(
    attributes: { email?: string; password?: string },
    options?: { emailRedirectTo?: string },
  ): Promise<{ error: unknown }>
  getSession(): Promise<{ data: { session: SessionLike | null }; error: unknown }>
  resend(credentials: {
    type: 'signup'
    email: string
    options?: { emailRedirectTo?: string }
  }): Promise<{ error: unknown }>
  onAuthStateChange(callback: (event: string, session: SessionLike | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
}

export interface SupabaseAuthServiceDeps {
  /**
   * Called once, on the first auth call (never when the service is created), so a build without
   * the Supabase variables can still start and show the "can't start" screen. The app passes
   * getSupabaseClient; tests pass a fake.
   */
  createClient: () => { auth: SupabaseAuthApi }
  /** Chooses where the next session is stored (client.ts). */
  setKeepSignedIn: (keep: boolean) => void
  /** The app's address, ending in '/', e.g. https://homeshelfie.com/app/. Email links come back here. */
  appUrl: string
}

/**
 * Where the reset email's link opens the app, relative to the app's address. A folder, so a static
 * host serves it without a rewrite rule (the build writes dist/app/reset-password/index.html).
 */
export const RESET_PASSWORD_PATH = 'reset-password/'

function toSession(session: SessionLike | null): AuthSession | null {
  if (!session) return null
  return { user: { id: session.user.id, email: session.user.email ?? '' } }
}

function requireValidPassword(password: string): void {
  if (!validatePassword(password).ok) throw new AuthFailure('weakPassword')
}

/**
 * Runs a Supabase call, turning both returned and thrown errors into an AuthFailure. A missing
 * configuration passes through as it is, so the app can tell it apart.
 */
async function call<T extends { error: unknown }>(request: () => Promise<T>): Promise<T> {
  let result: T
  try {
    result = await request()
  } catch (error) {
    if (error instanceof ConfigurationError) throw error
    throw toAuthFailure(error)
  }
  if (result.error) throw toAuthFailure(result.error)
  return result
}

export function createSupabaseAuthService(deps: SupabaseAuthServiceDeps): AuthService {
  let client: { auth: SupabaseAuthApi } | undefined
  /** The client's auth API, created on first use. */
  const api = (): SupabaseAuthApi => {
    client ??= deps.createClient()
    return client.auth
  }
  const appUrl = deps.appUrl
  const resetUrl = new URL(RESET_PASSWORD_PATH, appUrl).href

  return {
    async signUp(email, password) {
      requireValidPassword(password)
      const { data } = await call(() =>
        api().signUp({ email: email.trim(), password, options: { emailRedirectTo: appUrl } }),
      )
      return { needsConfirmation: data.session === null }
    },

    async resendConfirmation(email) {
      await call(() =>
        api().resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: appUrl } }),
      )
    },

    async signIn(email, password, keepSignedIn) {
      deps.setKeepSignedIn(keepSignedIn)
      const { data } = await call(() => api().signInWithPassword({ email: email.trim(), password }))
      const session = toSession(data.session)
      if (!session) throw new AuthFailure('unknown')
      return session
    },

    async signOut() {
      await call(() => api().signOut({ scope: 'local' }))
    },

    async signOutOthers() {
      await call(() => api().signOut({ scope: 'others' }))
    },

    async requestPasswordReset(email) {
      await call(() => api().resetPasswordForEmail(email.trim(), { redirectTo: resetUrl }))
    },

    async confirmPassword(password) {
      const { data } = await call(() => api().getSession())
      const email = data.session?.user.email
      if (!email) throw new AuthFailure('signInAgain')
      await call(() => api().signInWithPassword({ email, password }))
    },

    async updatePassword(newPassword) {
      requireValidPassword(newPassword)
      await call(() => api().updateUser({ password: newPassword }))
    },

    async updateEmail(newEmail) {
      await call(() => api().updateUser({ email: newEmail.trim() }, { emailRedirectTo: appUrl }))
    },

    async getSession() {
      const { data } = await call(() => api().getSession())
      return toSession(data.session)
    },

    onAuthStateChange(callback) {
      const { data } = api().onAuthStateChange((_event, session) => callback(toSession(session)))
      return () => data.subscription.unsubscribe()
    },

    async deleteAccount(): Promise<never> {
      throw new Error('Deleting an account is not available yet.')
    },
  }
}
