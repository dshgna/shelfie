// Passwords for Shelfie accounts: the suggestion behind "Generate password", and the one rule a
// password must meet. Pure functions: randomness comes in as a parameter (crypto.getRandomValues by
// default), so tests can check them. The account password never derives an encryption key (see
// docs/decisions.md, Open questions).
//
// A generated password follows the design's example (`cobalt-maple-river-tulip-42`) with capitals
// and a symbol added, so it also meets a "capitals, digits and symbols" rule:
// `Cobalt-Maple-River-Tulip-42!`. Four capitalised words and two digits joined by hyphens, then
// one symbol. Easy to read aloud and type on a phone; the digits avoid 0 and 1, which look like O
// and l, and the symbols avoid quotes, backticks, `|` and anything easily misread.

import { PASSWORD_WORDS } from './password-words'

export const GENERATED_WORD_COUNT = 4
export const GENERATED_DIGITS = '23456789'
export const GENERATED_SYMBOLS = '!#$%&*+=?@'
export const MIN_PASSWORD_LENGTH = 10

/** The shape of a generated password: four capitalised words and two digits joined by hyphens, then a symbol. */
export const GENERATED_PASSWORD_SHAPE = /^[A-Z][a-z]+(-[A-Z][a-z]+){3}-[2-9]{2}[!#$%&*+=?@]$/

/** Fills the array with random values, like crypto.getRandomValues. */
export type RandomFill = (array: Uint32Array<ArrayBuffer>) => void

const cryptoFill: RandomFill = (array) => {
  crypto.getRandomValues(array)
}

/** A random whole number from 0 to n - 1, without modulo bias (rejects the uneven top range). */
function randomBelow(n: number, fill: RandomFill): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n
  const buffer = new Uint32Array(1)
  for (;;) {
    fill(buffer)
    const value = buffer[0] ?? 0
    if (value < limit) return value % n
  }
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Four random words, two random digits and a random symbol, e.g. `Cobalt-Maple-River-Tulip-42!`. */
export function generatePassword(fill: RandomFill = cryptoFill): string {
  const pick = (characters: string) => characters.charAt(randomBelow(characters.length, fill))
  const parts: string[] = []
  for (let i = 0; i < GENERATED_WORD_COUNT; i += 1) {
    parts.push(capitalise(PASSWORD_WORDS[randomBelow(PASSWORD_WORDS.length, fill)] ?? ''))
  }
  parts.push(pick(GENERATED_DIGITS) + pick(GENERATED_DIGITS))
  return parts.join('-') + pick(GENERATED_SYMBOLS)
}

export type PasswordCheck = { ok: true } | { ok: false; problem: 'tooShort' }

/** At least 10 characters (counted as the person sees them, so an emoji counts once). */
export function validatePassword(password: string): PasswordCheck {
  return [...password].length >= MIN_PASSWORD_LENGTH
    ? { ok: true }
    : { ok: false, problem: 'tooShort' }
}
