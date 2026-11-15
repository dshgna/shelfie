// These functions assume dates were validated at the boundary (validateItem, import, migration).
// They throw rather than guess.
//
// Calendar-date helpers, ported from the prototype's startOfToday, plusDays, addDays and daysUntil.
// Domain code never reads the clock: "now" or "today" always comes in as a parameter.
//

/**
 * A calendar date written as "YYYY-MM-DD", for example "2026-11-14".
 * Dates are kept as strings, never Date objects: JSON, IndexedDB and sync can't store a Date
 * as a Date (it comes back as a string or not at all), and a plain day has no time zone to
 * get wrong. Check with isValidIsoDate.
 */
export type IsoDate = string

/**
 * A moment in UTC, in exactly the shape `Date.prototype.toISOString()` produces:
 * "2026-11-15T09:30:00.000Z" (four-digit year, milliseconds, and "Z", never an offset).
 * Used for when records were created, changed and synced.
 *
 * The fixed shape is what makes these strings sort correctly as plain text: every field has a
 * fixed width and they run from largest to smallest, so comparing two of them character by
 * character ("2026-11-15T09:30:00.000Z" < "2026-11-15T10:05:00.000Z") gives the same order as
 * comparing the moments. A shorter or offset form ("2026-11-15T09:30Z", "...+01:00") would break
 * that. Check with isValidIsoDateTime.
 */
export type IsoDateTime = string

/** Thrown when a function is given a date that isn't a real "YYYY-MM-DD" date (or a valid Date). */
export class InvalidDateError extends Error {
  /** The value that was rejected, exactly as it was passed in. */
  readonly value: string

  constructor(value: string, where: string) {
    super(`${where}: "${value}" is not a valid YYYY-MM-DD date`)
    this.name = 'InvalidDateError'
    this.value = value
  }
}

const MS_PER_DAY = 86_400_000
const ISO_DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Turns "YYYY-MM-DD" into a day number on the UTC timeline, or undefined if it isn't a real date.
 *
 * Why UTC: in UTC every day is exactly 24 hours long. Local time has a 23-hour day and a 25-hour
 * day each year where daylight saving starts and ends, so subtracting or adding local midnights
 * can land an hour short or long and round to the wrong day. Here, "UTC midnight of a calendar
 * date" is only a convenient way to number days; no time zone is involved.
 */
function toUtcDay(value: string): number | undefined {
  const match = ISO_DATE_SHAPE.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  // Date.UTC silently rolls impossible dates over (2026-02-30 becomes 2026-03-02, month 13 becomes
  // next January), so convert back and check that nothing moved.
  const check = new Date(ms)
  const same =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  return same ? ms / MS_PER_DAY : undefined
}

/** Formats a UTC day number as "YYYY-MM-DD". */
function fromUtcDay(utcDay: number): string {
  const date = new Date(utcDay * MS_PER_DAY)
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * True only for a real calendar date written as "YYYY-MM-DD".
 * Rejects other shapes ("2026-1-5", "2026-01-05T10:00") and impossible dates ("2026-02-30",
 * "2026-13-01"). Years before 0100 are rejected too (Date.UTC reads 0050 as 1950).
 */
export function isValidIsoDate(value: string): boolean {
  return toUtcDay(value) !== undefined
}

const ISO_DATE_TIME_SHAPE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * True only for a real moment written exactly as toISOString() writes it, such as
 * "2026-11-15T09:30:00.000Z". Rejects other shapes (no milliseconds, an offset such as "+01:00"
 * instead of "Z", a date on its own), impossible dates ("2026-02-30T..."), impossible times
 * ("T24:00:00.000Z", "T09:60:00.000Z") and, like isValidIsoDate, years before 0100.
 */
export function isValidIsoDateTime(value: string): boolean {
  const match = ISO_DATE_TIME_SHAPE.exec(value)
  if (!match || !isValidIsoDate(match[1] ?? '')) return false
  // Round trip: a Date silently rolls impossible times over, so writing it back out only gives
  // the same text when every part was real.
  const ms = new Date(value).getTime()
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value
}

/**
 * The local calendar date of `now`, as "YYYY-MM-DD". The caller passes the moment (the UI passes
 * `new Date()`). Local, not UTC: at 23:30 on 14 November in London or Sydney the answer is
 * 14 November, even though in UTC it may already be the 15th or still the 14th.
 * Prototype: toISO(startOfToday()).
 *
 * @throws InvalidDateError if `now` is an Invalid Date.
 */
export function startOfToday(now: Date): IsoDate {
  const ms = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  if (Number.isNaN(ms)) throw new InvalidDateError(String(now), 'startOfToday')
  return fromUtcDay(ms / MS_PER_DAY)
}

/**
 * The date `days` calendar days after `date` (before it when `days` is negative).
 * Counts calendar days, so a daylight saving change in between can't move the result.
 * Prototype: addDays(iso, n), and plusDays(n) is plusDays(today, n).
 *
 * @throws InvalidDateError if `date` isn't a valid IsoDate.
 * @throws RangeError if `days` isn't a whole number, or the result falls outside the years 0100
 * to 9999.
 */
export function plusDays(date: IsoDate, days: number): IsoDate {
  const start = toUtcDay(date)
  if (start === undefined) throw new InvalidDateError(date, 'plusDays')
  if (!Number.isInteger(days))
    throw new RangeError(`plusDays: ${days} is not a whole number of days`)
  const result = fromUtcDay(start + days)
  if (!isValidIsoDate(result)) throw new RangeError(`plusDays: result is out of range (${result})`)
  return result
}

/**
 * How many calendar days from `from` to `to`: positive when `to` is later, 0 for the same day,
 * negative when `to` is in the past (yesterday is -1), as in the prototype.
 * Prototype: daysUntil(iso) is daysUntil(today, iso).
 *
 * Unlike the prototype, which returned NaN for bad text, this throws: a NaN would make checks such
 * as `daysUntil(today, expiry) <= 0` quietly false, so an item with a corrupt date would never
 * show as due.
 *
 * @throws InvalidDateError if either date isn't a valid IsoDate (`from` is checked first).
 */
export function daysUntil(from: IsoDate, to: IsoDate): number {
  const start = toUtcDay(from)
  if (start === undefined) throw new InvalidDateError(from, 'daysUntil')
  const end = toUtcDay(to)
  if (end === undefined) throw new InvalidDateError(to, 'daysUntil')
  // Both are whole day numbers on a timeline without daylight saving, so no rounding is needed.
  return end - start
}
