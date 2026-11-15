import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  InvalidDateError,
  daysUntil,
  isValidIsoDate,
  isValidIsoDateTime,
  plusDays,
  startOfToday,
  type IsoDate,
  type IsoDateTime,
} from '../dates'
import type { IsoDate as IsoDateFromItem } from '../item'

/** Impossible date, not a date at all, empty, and the wrong shape. */
const BAD_DATES = ['2026-02-30', 'not a date', '', '2026-1-5']

/** Checks that `run` throws an InvalidDateError that names the rejected value. */
function expectInvalidDate(run: () => unknown, value: string): void {
  let caught: unknown
  try {
    run()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(InvalidDateError)
  const error = caught as InvalidDateError
  expect(error.name).toBe('InvalidDateError')
  expect(error.value).toBe(value)
  expect(error.message).toContain(`"${value}"`)
}

// All dates are invented. The only use of the machine's time zone is in startOfToday's tests,
// which build their Dates from local year/month/day values, so they give the same answer anywhere.

describe('isValidIsoDate', () => {
  it.each([
    { value: '2026-11-14', valid: true },
    { value: '2026-01-31', valid: true },
    { value: '2028-02-29', valid: true },
    { value: '2026-12-31', valid: true },
    { value: '2026-02-29', valid: false }, // 2026 is not a leap year
    { value: '2026-02-30', valid: false },
    { value: '2026-04-31', valid: false },
    { value: '2026-13-01', valid: false },
    { value: '2026-00-10', valid: false },
    { value: '2026-01-00', valid: false },
    { value: '2026-1-5', valid: false },
    { value: '26-01-05', valid: false },
    { value: '2026/01/05', valid: false },
    { value: '2026-01-05T10:00', valid: false },
    { value: ' 2026-01-05', valid: false },
    { value: '', valid: false },
    { value: 'abcd-ef-gh', valid: false },
  ])('$value is valid: $valid', ({ value, valid }) => {
    expect(isValidIsoDate(value)).toBe(valid)
  })
})

describe('plusDays', () => {
  it.each([
    // Month ends
    { date: '2026-01-31', days: 1, expected: '2026-02-01' },
    { date: '2026-04-30', days: 1, expected: '2026-05-01' },
    { date: '2026-03-01', days: -1, expected: '2026-02-28' },
    // Leap year and non-leap year
    { date: '2026-02-28', days: 1, expected: '2026-03-01' },
    { date: '2028-02-28', days: 1, expected: '2028-02-29' },
    { date: '2028-02-29', days: 1, expected: '2028-03-01' },
    { date: '2028-03-01', days: -1, expected: '2028-02-29' },
    // Year boundary
    { date: '2026-12-31', days: 1, expected: '2027-01-01' },
    { date: '2027-01-01', days: -1, expected: '2026-12-31' },
    // Zero, negative and large
    { date: '2026-11-14', days: 0, expected: '2026-11-14' },
    { date: '2026-11-14', days: -14, expected: '2026-10-31' },
    { date: '2026-01-01', days: 365, expected: '2027-01-01' },
    { date: '2028-01-01', days: 366, expected: '2029-01-01' },
    { date: '2026-01-01', days: 10000, expected: '2053-05-19' },
    { date: '2026-01-01', days: -10000, expected: '1998-08-16' },
    // Across the 2026 daylight saving changes (US: 8 March and 1 November; EU: 29 March and 25 October)
    { date: '2026-03-07', days: 1, expected: '2026-03-08' },
    { date: '2026-03-08', days: 1, expected: '2026-03-09' },
    { date: '2026-10-31', days: 1, expected: '2026-11-01' },
    { date: '2026-11-01', days: 1, expected: '2026-11-02' },
    { date: '2026-03-28', days: 2, expected: '2026-03-30' },
    { date: '2026-10-24', days: 2, expected: '2026-10-26' },
  ])('$date + $days = $expected', ({ date, days, expected }) => {
    expect(plusDays(date, days)).toBe(expected)
  })

  it.each([...BAD_DATES, '14/11/2026'])('throws InvalidDateError for %j', (bad) => {
    expectInvalidDate(() => plusDays(bad, 1), bad)
  })

  // Not a bad date, so these stay RangeErrors.
  it.each([
    { case: 'a fraction of a day', date: '2026-11-14', days: 1.5 },
    { case: 'NaN days', date: '2026-11-14', days: Number.NaN },
    { case: 'a result past 9999', date: '9999-12-31', days: 1 },
  ])('throws a RangeError for $case', ({ date, days }) => {
    expect(() => plusDays(date, days)).toThrow(RangeError)
    expect(() => plusDays(date, days)).not.toThrow(InvalidDateError)
  })
})

describe('daysUntil', () => {
  it.each([
    { from: '2026-11-14', to: '2026-11-14', expected: 0 },
    { from: '2026-11-14', to: '2026-11-15', expected: 1 },
    { from: '2026-11-14', to: '2026-11-13', expected: -1 },
    { from: '2026-11-14', to: '2026-11-01', expected: -13 },
    // Month ends, leap and non-leap February
    { from: '2026-01-31', to: '2026-02-01', expected: 1 },
    { from: '2026-02-01', to: '2026-03-01', expected: 28 },
    { from: '2028-02-01', to: '2028-03-01', expected: 29 },
    { from: '2028-02-29', to: '2028-03-01', expected: 1 },
    // Year boundary and whole years
    { from: '2026-12-31', to: '2027-01-01', expected: 1 },
    { from: '2026-01-01', to: '2027-01-01', expected: 365 },
    { from: '2028-01-01', to: '2029-01-01', expected: 366 },
    // Across the daylight saving changes
    { from: '2026-03-07', to: '2026-03-09', expected: 2 },
    { from: '2026-10-31', to: '2026-11-02', expected: 2 },
    { from: '2026-03-28', to: '2026-03-30', expected: 2 },
    { from: '2026-10-24', to: '2026-10-26', expected: 2 },
    { from: '2026-03-01', to: '2026-04-01', expected: 31 },
  ])('$from to $to is $expected', ({ from, to, expected }) => {
    expect(daysUntil(from, to)).toBe(expected)
  })

  it.each(BAD_DATES)('throws InvalidDateError when from is %j', (bad) => {
    expectInvalidDate(() => daysUntil(bad, '2026-11-14'), bad)
  })

  it.each(BAD_DATES)('throws InvalidDateError when to is %j', (bad) => {
    expectInvalidDate(() => daysUntil('2026-11-14', bad), bad)
  })

  it('agrees with plusDays', () => {
    expect(daysUntil('2026-11-14', plusDays('2026-11-14', 137))).toBe(137)
  })
})

describe('startOfToday', () => {
  // new Date(year, monthIndex, day, hours, minutes) is read as local time, and startOfToday reads
  // local time, so these give the same answer in every time zone. Month index 0 is January.
  it.each([
    { case: '00:00', now: new Date(2026, 10, 14, 0, 0), expected: '2026-11-14' },
    { case: '23:59', now: new Date(2026, 10, 14, 23, 59), expected: '2026-11-14' },
    { case: 'noon on a leap day', now: new Date(2028, 1, 29, 12, 0), expected: '2028-02-29' },
    {
      case: 'the last minute of a year',
      now: new Date(2026, 11, 31, 23, 59),
      expected: '2026-12-31',
    },
    { case: 'a US daylight saving day', now: new Date(2026, 2, 8, 23, 59), expected: '2026-03-08' },
    { case: 'an EU daylight saving day', now: new Date(2026, 9, 25, 0, 0), expected: '2026-10-25' },
  ])('at $case', ({ now, expected }) => {
    expect(startOfToday(now)).toBe(expected)
  })

  // startOfToday takes a Date, not text, so the BAD_DATES strings can't be passed to it. Its only
  // bad input is an Invalid Date (what `new Date('not a date')` produces).
  it('throws InvalidDateError for an Invalid Date', () => {
    expectInvalidDate(() => startOfToday(new Date(Number.NaN)), 'Invalid Date')
  })
})

describe('year limits (added in the test review)', () => {
  it.each([
    { value: '0099-12-31', valid: false }, // Date.UTC reads years 0-99 as 1900-1999
    { value: '0100-01-01', valid: true },
    { value: '9999-12-31', valid: true },
  ])('$value is valid: $valid', ({ value, valid }) => {
    expect(isValidIsoDate(value)).toBe(valid)
  })

  it('throws a RangeError for a result before the year 0100', () => {
    expect(() => plusDays('0100-01-01', -1)).toThrow(RangeError)
  })
})

describe('isValidIsoDateTime', () => {
  it.each([
    // Valid: exactly what toISOString() writes
    { value: '2026-11-15T09:30:00.000Z', valid: true },
    { value: '2028-02-29T23:59:59.999Z', valid: true }, // leap day
    { value: '2026-12-31T23:59:59.999Z', valid: true }, // last moment of a year
    { value: '0100-01-01T00:00:00.000Z', valid: true },
    { value: '9999-12-31T23:59:59.999Z', valid: true },
    // Wrong shape
    { value: '2026-11-15 09:30:00.000Z', valid: false }, // space instead of T
    { value: '2026-11-15t09:30:00.000z', valid: false }, // lowercase
    { value: '2026-11-15T9:30:00.000Z', valid: false }, // one-digit hour
    { value: '+012026-11-15T09:30:00.000Z', valid: false }, // extended year
    { value: ' 2026-11-15T09:30:00.000Z', valid: false },
    { value: '', valid: false },
    { value: 'not a date', valid: false },
    // An offset instead of Z
    { value: '2026-11-15T09:30:00.000+00:00', valid: false },
    { value: '2026-11-15T10:30:00.000+01:00', valid: false },
    // Missing (or extra) fractions of a second
    { value: '2026-11-15T09:30:00Z', valid: false },
    { value: '2026-11-15T09:30Z', valid: false },
    { value: '2026-11-15T09:30:00.0Z', valid: false },
    { value: '2026-11-15T09:30:00.000000Z', valid: false },
    // Impossible dates and times
    { value: '2026-02-30T09:30:00.000Z', valid: false },
    { value: '2026-02-29T09:30:00.000Z', valid: false }, // 2026 isn't a leap year
    { value: '2026-13-01T09:30:00.000Z', valid: false },
    { value: '2026-11-15T24:00:00.000Z', valid: false },
    { value: '2026-11-15T09:60:00.000Z', valid: false },
    { value: '2026-11-15T09:30:60.000Z', valid: false }, // no leap seconds
    // Before the year 0100, as isValidIsoDate
    { value: '0099-12-31T23:59:59.999Z', valid: false },
    // A date on its own
    { value: '2026-11-15', valid: false },
  ])('$value is valid: $valid', ({ value, valid }) => {
    expect(isValidIsoDateTime(value)).toBe(valid)
  })

  it('accepts what toISOString() writes, and keeps text order the same as time order', () => {
    const earlier = new Date(Date.UTC(2026, 10, 15, 9, 30)).toISOString()
    const later = new Date(Date.UTC(2026, 10, 15, 10, 5)).toISOString()
    expect(isValidIsoDateTime(earlier)).toBe(true)
    expect(earlier < later).toBe(true)
  })

  // A date-time is not a date: the calendar functions still refuse it.
  it.each(['2026-11-15T09:30:00.000Z'])(
    'plusDays and daysUntil throw InvalidDateError for %s',
    (value) => {
      expectInvalidDate(() => plusDays(value, 1), value)
      expectInvalidDate(() => daysUntil(value, '2026-11-15'), value)
    },
  )

  it('types both as text, and item.ts re-exports the same IsoDate', () => {
    expectTypeOf<IsoDate>().toEqualTypeOf<string>()
    expectTypeOf<IsoDateTime>().toEqualTypeOf<string>()
    expectTypeOf<IsoDateFromItem>().toEqualTypeOf<IsoDate>()
  })
})
