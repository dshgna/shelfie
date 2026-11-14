import { describe, expect, it } from 'vitest'
import { InvalidDateError, daysUntil, isValidIsoDate, plusDays, startOfToday } from './dates'

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
