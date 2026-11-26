import { describe, expect, it } from 'vitest'
import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  AuthFailure,
  toAuthErrorCode,
  toAuthFailure,
} from '../errors'

/** Shaped like supabase-js's AuthApiError / AuthError, with invented wording. */
function supabaseError(fields: { code?: string; status?: number; name?: string }) {
  return Object.assign(new Error('Raw server wording that must never reach the UI'), {
    name: 'AuthApiError',
    __isAuthError: true,
    ...fields,
  })
}

describe('toAuthErrorCode', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'invalidCredentials'],
    [{ code: 'user_not_found', status: 404 }, 'invalidCredentials'],
    [{ code: 'email_exists', status: 422 }, 'emailInUse'],
    [{ code: 'user_already_exists', status: 422 }, 'emailInUse'],
    [{ code: 'weak_password', status: 422 }, 'weakPassword'],
    [{ name: 'AuthWeakPasswordError', status: 422 }, 'weakPassword'],
    [{ code: 'email_not_confirmed', status: 400 }, 'emailNotConfirmed'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rateLimited'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rateLimited'],
    [{ status: 429 }, 'rateLimited'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'network'],
    [{ code: 'request_timeout', status: 504 }, 'network'],
    [{ code: 'reauthentication_needed', status: 400 }, 'signInAgain'],
    [{ code: 'reauthentication_not_valid', status: 400 }, 'signInAgain'],
    [{ code: 'session_expired', status: 403 }, 'signInAgain'],
    [{ code: 'unexpected_failure', status: 500 }, 'unknown'],
    [{ code: 'validation_failed', status: 400 }, 'unknown'],
  ] as const)('maps %o to %s', (fields, code) => {
    expect(toAuthErrorCode(supabaseError(fields))).toBe(code)
  })

  it('treats a failed fetch as a network problem', () => {
    expect(toAuthErrorCode(new TypeError('Failed to fetch'))).toBe('network')
  })

  it('treats anything else as unknown', () => {
    for (const value of [undefined, null, 'text', 42, {}, new Error('x'), { code: 'toString' }]) {
      expect(toAuthErrorCode(value)).toBe('unknown')
    }
  })

  it('gives an unknown email and a wrong password the same code and message', () => {
    const wrongPassword = toAuthFailure(supabaseError({ code: 'invalid_credentials', status: 400 }))
    const unknownEmail = toAuthFailure(supabaseError({ code: 'user_not_found', status: 404 }))
    expect(unknownEmail.code).toBe(wrongPassword.code)
    expect(unknownEmail.message).toBe(wrongPassword.message)
  })
})

describe('AuthFailure', () => {
  it('has Shelfie wording for every code, never the raw message', () => {
    for (const code of AUTH_ERROR_CODES) {
      const failure = new AuthFailure(code)
      expect(failure.code).toBe(code)
      expect(failure.message).toBe(AUTH_ERROR_MESSAGES[code])
      expect(failure.message.length).toBeGreaterThan(0)
    }
    const mapped = toAuthFailure(supabaseError({ code: 'invalid_credentials' }))
    expect(mapped.message).not.toContain('Raw server wording')
    expect(mapped.cause).toBeUndefined()
  })

  it('passes an AuthFailure through unchanged', () => {
    const failure = new AuthFailure('rateLimited')
    expect(toAuthFailure(failure)).toBe(failure)
    expect(toAuthErrorCode(failure)).toBe('rateLimited')
  })
})
