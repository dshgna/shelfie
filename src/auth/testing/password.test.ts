import { describe, expect, it } from 'vitest'
import {
  GENERATED_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_CHARACTER_SETS,
  generatePassword,
  validatePassword,
  type RandomFill,
} from '../password'

const LOOK_ALIKES = ['0', 'O', 'o', '1', 'l', 'I', 'i', '|']
const ALL = Object.values(PASSWORD_CHARACTER_SETS).join('')

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

describe('generatePassword', () => {
  const samples = Array.from({ length: 200 }, () => generatePassword())

  it('is 16 characters long', () => {
    expect(GENERATED_PASSWORD_LENGTH).toBe(16)
    for (const password of samples) expect(password).toHaveLength(16)
  })

  it.each(Object.entries(PASSWORD_CHARACTER_SETS))('always includes a %s character', (_, set) => {
    for (const password of samples) {
      expect(
        [...password].some((c) => set.includes(c)),
        password,
      ).toBe(true)
    }
  })

  it('uses only the readable set, never a look-alike', () => {
    for (const set of Object.values(PASSWORD_CHARACTER_SETS)) {
      for (const c of LOOK_ALIKES) expect(set).not.toContain(c)
    }
    for (const password of samples) {
      for (const c of password) expect(ALL).toContain(c)
    }
  })

  it('differs between calls', () => {
    expect(generatePassword()).not.toBe(generatePassword())
    expect(new Set(samples).size).toBe(samples.length)
  })

  it('still has every kind of character with a source that always gives the same value', () => {
    const password = generatePassword(sequence([0]))
    expect(password).toHaveLength(16)
    for (const set of Object.values(PASSWORD_CHARACTER_SETS)) {
      expect([...password].some((c) => set.includes(c))).toBe(true)
    }
  })

  it('uses every character of the readable set', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generatePassword()).join(''))
    expect([...ALL].filter((c) => !seen.has(c))).toEqual([])
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

  it('accepts every generated password', () => {
    for (let i = 0; i < 50; i += 1) expect(validatePassword(generatePassword()).ok).toBe(true)
  })
})
