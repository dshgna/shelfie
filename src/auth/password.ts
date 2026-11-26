// Passwords for Shelfie accounts: the suggestion behind "Generate password", and the one rule a
// password must meet. Pure functions: randomness comes in as a parameter (crypto.getRandomValues by
// default), so tests can check them. The account password never derives an encryption key (see
// docs/decisions.md, Open questions).

/** Letters and digits that can't be mistaken for each other: no 0/O/o, no 1/l/I/i. */
const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
/** Symbols that are easy to read and type: no quotes, backticks, `|`, `,` or `.`. */
const SYMBOLS = '!#$%&*+-=?@^_~'

export const PASSWORD_CHARACTER_SETS = {
  lowercase: LOWERCASE,
  uppercase: UPPERCASE,
  digit: DIGITS,
  symbol: SYMBOLS,
} as const

const ALL_CHARACTERS = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS

export const GENERATED_PASSWORD_LENGTH = 16
export const MIN_PASSWORD_LENGTH = 10

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

function pick(characters: string, fill: RandomFill): string {
  return characters.charAt(randomBelow(characters.length, fill))
}

/**
 * A 16-character password from the readable set, with at least one lowercase letter, uppercase
 * letter, digit and symbol, in a random order.
 */
export function generatePassword(fill: RandomFill = cryptoFill): string {
  const characters = Object.values(PASSWORD_CHARACTER_SETS).map((set) => pick(set, fill))
  while (characters.length < GENERATED_PASSWORD_LENGTH) {
    characters.push(pick(ALL_CHARACTERS, fill))
  }
  // Fisher-Yates shuffle, so the guaranteed characters aren't always at the start.
  for (let i = characters.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1, fill)
    const a = characters[i] ?? ''
    characters[i] = characters[j] ?? ''
    characters[j] = a
  }
  return characters.join('')
}

export type PasswordCheck = { ok: true } | { ok: false; problem: 'tooShort' }

/** At least 10 characters (counted as the person sees them, so an emoji counts once). */
export function validatePassword(password: string): PasswordCheck {
  return [...password].length >= MIN_PASSWORD_LENGTH
    ? { ok: true }
    : { ok: false, problem: 'tooShort' }
}
