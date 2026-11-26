import { describe, expect, it } from 'vitest'
import { currentPasswordError, emailError, newPasswordError, summaryOf } from '../validation'

describe('sign-in form checks', () => {
  it('needs an email shaped like one', () => {
    expect(emailError('')).toBe('Enter your email.')
    expect(emailError('   ')).toBe('Enter your email.')
    expect(emailError('person')).toBe('Enter an email like name@example.com.')
    expect(emailError('person@example')).toBe('Enter an email like name@example.com.')
    expect(emailError('person@example.test')).toBeUndefined()
    expect(emailError(' person@example.test ')).toBeUndefined()
  })

  it('needs a new password of at least 10 characters (validatePassword)', () => {
    expect(newPasswordError('')).toBe('Enter a password, or generate one.')
    expect(newPasswordError('123456789')).toBe('Use at least 10 characters.')
    expect(newPasswordError('1234567890')).toBeUndefined()
  })

  it('only needs something typed to sign in', () => {
    expect(currentPasswordError('')).toBe('Enter your password.')
    expect(currentPasswordError('short')).toBeUndefined()
  })

  it('sums up the problems in screen order', () => {
    expect(summaryOf([undefined, undefined])).toBeUndefined()
    expect(summaryOf(['Enter your email.', undefined])).toBe('Enter your email.')
    expect(summaryOf(['Enter your email.', 'Enter your password.'])).toBe(
      'There are 2 problems: Enter your email. Enter your password.',
    )
  })
})
