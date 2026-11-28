import { describe, expect, it } from 'vitest'
import {
  GENERATED_PASSWORD_SHAPE,
  MIN_PASSWORD_LENGTH,
  generatePassword,
  validatePassword,
  type RandomFill,
} from '../password'
import { PASSWORD_WORDS } from '../password-words'

/** A predictable "random" source: returns the given values in turn, then repeats them. */
function sequence(values: number[]): RandomFill {
  let i = 0
  return (array) => {
    for (let k = 0; k < array.length; k += 1) {
      array[k] = values[i % values.length] ?? 0
      i += 1
    }
  }
}

describe('the word list', () => {
  it('has enough plain, unique words', () => {
    expect(PASSWORD_WORDS.length).toBeGreaterThanOrEqual(600)
    expect(new Set(PASSWORD_WORDS).size).toBe(PASSWORD_WORDS.length)
    for (const word of PASSWORD_WORDS) expect(word).toMatch(/^[a-z]{3,9}$/)
  })
})

describe('generatePassword', () => {
  const samples = Array.from({ length: 300 }, () => generatePassword())

  it('looks like the design with capitals and a symbol: Cobalt-Maple-River-Tulip-42!', () => {
    for (const password of samples) expect(password).toMatch(GENERATED_PASSWORD_SHAPE)
  })

  it('uses only words from the list, digits without 0 or 1, and a readable symbol', () => {
    for (const password of samples) {
      const parts = password.split('-')
      expect(parts).toHaveLength(5)
      for (const word of parts.slice(0, 4)) {
        expect(word.charAt(0)).toMatch(/[A-Z]/)
        expect(PASSWORD_WORDS).toContain(word.toLowerCase())
      }
      expect(parts[4]).toMatch(/^[2-9]{2}[!#$%&*+=?@]$/)
    }
  })

  it('always has a lowercase letter, a capital, a digit and a symbol', () => {
    for (const password of samples) {
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[^A-Za-z0-9]/)
    }
  })

  it('picks the words and digits from the random source', () => {
    const cap = (i: number) => {
      const word = PASSWORD_WORDS[i] ?? ''
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    expect(generatePassword(sequence([0, 1, 2, 3, 0, 7, 9]))).toBe(
      `${cap(0)}-${cap(1)}-${cap(2)}-${cap(3)}-29@`,
    )
  })

  it('differs between calls', () => {
    expect(generatePassword()).not.toBe(generatePassword())
    expect(new Set(samples).size).toBe(samples.length)
  })

  it('always passes the password rule', () => {
    for (const password of samples) expect(validatePassword(password).ok).toBe(true)
  })
})

describe('validatePassword', () => {
  it('needs at least 10 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10)
    expect(validatePassword('')).toEqual({ ok: false, problem: 'tooShort' })
    expect(validatePassword('abcdefghi')).toEqual({ ok: false, problem: 'tooShort' })
    expect(validatePassword('abcdefghij')).toEqual({ ok: true })
    expect(validatePassword('a much longer passphrase')).toEqual({ ok: true })
  })

  it('counts characters as people see them', () => {
    expect(validatePassword('🌿🌿🌿🌿🌿🌿🌿🌿🌿')).toEqual({ ok: false, problem: 'tooShort' })
    expect(validatePassword('🌿🌿🌿🌿🌿🌿🌿🌿🌿🌿')).toEqual({ ok: true })
  })
})
