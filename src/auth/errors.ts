// Turns whatever Supabase Auth (or the network) throws into a small set of Shelfie error codes.
// The UI shows only AUTH_ERROR_MESSAGES, never a raw Supabase message, and nothing here logs or
// keeps the original error (it could hold an email address).
//
// A wrong password and an email with no account give the same code and message, so the sign-in
// form can't be used to find out who has an account.

export type AuthErrorCode =
  | 'invalidCredentials'
  | 'emailInUse'
  | 'weakPassword'
  | 'emailNotConfirmed'
  | 'rateLimited'
  | 'signInAgain'
  | 'network'
  | 'unknown'

export const AUTH_ERROR_CODES: readonly AuthErrorCode[] = [
  'invalidCredentials',
  'emailInUse',
  'weakPassword',
  'emailNotConfirmed',
  'rateLimited',
  'signInAgain',
  'network',
  'unknown',
]

/** Plain wording for each code. The sign-in screens may reword these; never show error.message from Supabase. */
export const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  invalidCredentials: "That email and password don't match. Check them and try again.",
  emailInUse: 'There is already an account with this email. Try signing in.',
  weakPassword: 'Choose a longer password: at least 10 characters.',
  emailNotConfirmed: 'Confirm your email first: open the link we sent you.',
  rateLimited: 'Too many tries. Wait a few minutes and try again.',
  signInAgain: 'Please sign in again to change this.',
  network: "Can't reach Shelfie. Check your connection and try again.",
  unknown: 'Something went wrong. Try again.',
}

/** What the auth service throws. Its message is Shelfie's own wording, never Supabase's. */
export class AuthFailure extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(AUTH_ERROR_MESSAGES[code])
    this.name = 'AuthFailure'
    this.code = code
  }
}

/**
 * A build without VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Names the variable, never a value.
 * The app shows a plain "can't start" screen for it (status 'unavailable'), never a blank page.
 */
export class ConfigurationError extends Error {
  readonly variable: string

  constructor(variable: string) {
    super(`${variable} is not set. Add it to .env.local, or to the host's build environment.`)
    this.name = 'ConfigurationError'
    this.variable = variable
  }
}

/** Supabase Auth error codes (AuthError.code) that Shelfie tells apart. */
const SUPABASE_CODES: Readonly<Record<string, AuthErrorCode>> = {
  invalid_credentials: 'invalidCredentials',
  // Same as a wrong password, so accounts can't be enumerated.
  user_not_found: 'invalidCredentials',
  email_exists: 'emailInUse',
  user_already_exists: 'emailInUse',
  weak_password: 'weakPassword',
  email_not_confirmed: 'emailNotConfirmed',
  over_request_rate_limit: 'rateLimited',
  over_email_send_rate_limit: 'rateLimited',
  request_timeout: 'network',
  // Changing the email or password needs a recent sign-in.
  reauthentication_needed: 'signInAgain',
  reauthentication_not_valid: 'signInAgain',
  session_expired: 'signInAgain',
}

function field(error: object, name: string): unknown {
  return (error as Record<string, unknown>)[name]
}

export function toAuthErrorCode(error: unknown): AuthErrorCode {
  if (error instanceof AuthFailure) return error.code
  if (typeof error !== 'object' || error === null) return 'unknown'

  const code = field(error, 'code')
  if (typeof code === 'string' && Object.hasOwn(SUPABASE_CODES, code)) {
    return SUPABASE_CODES[code] ?? 'unknown'
  }
  const name = field(error, 'name')
  if (name === 'AuthWeakPasswordError') return 'weakPassword'
  // supabase-js wraps failed fetches (offline, DNS, CORS) in AuthRetryableFetchError.
  if (name === 'AuthRetryableFetchError') return 'network'
  const status = field(error, 'status')
  if (status === 429) return 'rateLimited'
  // A fetch that never reached the server.
  if (error instanceof TypeError) return 'network'
  return 'unknown'
}

export function toAuthFailure(error: unknown): AuthFailure {
  return error instanceof AuthFailure ? error : new AuthFailure(toAuthErrorCode(error))
}
