// Checks for the sign-in forms, run on blur and on submit. Pure, so they are unit tested.
// The password rule is validatePassword's (src/auth/password.ts), so the screens and the service
// agree.

import { MIN_PASSWORD_LENGTH, validatePassword } from '../../auth/password'

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailError(email: string): string | undefined {
  const value = email.trim()
  if (value === '') return 'Enter your email.'
  if (!EMAIL_SHAPE.test(value)) return 'Enter an email like name@example.com.'
  return undefined
}

/** For a new password (create account, reset): the shared rule. */
export function newPasswordError(password: string): string | undefined {
  if (password === '') return 'Enter a password, or generate one.'
  if (!validatePassword(password).ok) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  return undefined
}

/**
 * For signing in: only that something was typed. The length rule is not checked here, so the
 * form never hints at anything about the account; a wrong password gets the one sign-in message.
 */
export function currentPasswordError(password: string): string | undefined {
  return password === '' ? 'Enter your password.' : undefined
}

/** The error summary's text: the field problems in screen order. */
export function summaryOf(errors: readonly (string | undefined)[]): string | undefined {
  const problems = errors.filter((e): e is string => e !== undefined)
  if (problems.length === 0) return undefined
  return problems.length === 1
    ? problems[0]
    : `There are ${problems.length} problems: ${problems.join(' ')}`
}
