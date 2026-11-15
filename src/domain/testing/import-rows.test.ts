import { describe, expect, it } from 'vitest'
import { InvalidDateError } from '../dates'
import {
  findMatch,
  normRow,
  normalizeForMatch,
  titleCase,
  type ImportDraft,
  type ImportIssueCode,
  type NormRowResult,
} from '../import-rows'
import type { Item } from '../item'
import { calcStock } from '../stock'
import { TODAY, makeItem } from './helpers/fixtures'

// Invented example data, not anyone's real orders or inventory.

/** A tidy row as the AI prompt asks for it. */
const cleanRow = {
  name: 'Lemon Washing-Up Liquid',
  brand: 'Exampleside',
  size: '500 ml',
  unit: 'bottle',
  count: 2,
  date: '2026-11-01',
  shop: 'Corner Shop',
  cat: 'kitchen',
  sub: 'Dishwashing',
  status: 'delivered',
  confidence: 'high',
  note: '',
  alts: [],
}

const cleanDraft: ImportDraft = {
  name: 'Lemon Washing-Up Liquid',
  brand: 'Exampleside',
  size: '500 ml',
  unit: 'bottle',
  quantity: 2,
  boughtAt: '2026-11-01',
  shop: 'Corner Shop',
  category: 'kitchen',
  group: 'Dishwashing',
  reason: '',
  alternatives: [],
  confidence: 'high',
  mark: 'mine',
  links: {},
}

/** Runs normRow and fails the test if there is no draft. */
function draftOf(raw: unknown): Extract<NormRowResult, { ok: true }> {
  const result = normRow(raw, TODAY)
  if (!result.ok) throw new Error(`expected a draft, got ${result.reason}`)
  return result
}

function codesOf(raw: unknown): ImportIssueCode[] {
  return draftOf(raw).issues.map((issue) => issue.code)
}

describe('normRow', () => {
  it('keeps a clean row as it is, with no issues', () => {
    expect(draftOf(cleanRow)).toEqual({ ok: true, draft: cleanDraft, issues: [] })
  })

  it('gives defaults, without issues, for a row with only a name', () => {
    expect(draftOf({ name: 'cotton pads' })).toEqual({
      ok: true,
      draft: {
        name: 'Cotton Pads',
        brand: '',
        size: '',
        unit: 'bottle',
        quantity: 1,
        boughtAt: TODAY,
        shop: '',
        category: 'household',
        group: 'Other',
        reason: '',
        alternatives: [],
        confidence: 'medium',
        mark: 'mine',
        links: {},
      },
      issues: [],
    })
  })

  it.each([
    { case: 'null', raw: null, reason: 'not-an-object' },
    { case: 'undefined', raw: undefined, reason: 'not-an-object' },
    { case: 'a string', raw: 'Lemon Washing-Up Liquid', reason: 'not-an-object' },
    { case: 'a number', raw: 42, reason: 'not-an-object' },
    { case: 'an array', raw: [cleanRow], reason: 'not-an-object' },
    { case: 'no name', raw: { brand: 'Exampleside' }, reason: 'no-name' },
    { case: 'an empty name', raw: { name: '' }, reason: 'no-name' },
    { case: 'a null name', raw: { name: null }, reason: 'no-name' },
    { case: 'an object as name', raw: { name: { text: 'Soap' } }, reason: 'no-name' },
    { case: 'true as name', raw: { name: true }, reason: 'no-name' },
    { case: 'NaN as name', raw: { name: Number.NaN }, reason: 'no-name' },
  ])('rejects $case', ({ raw, reason }) => {
    expect(normRow(raw, TODAY)).toEqual({ ok: false, reason })
  })

  it.each<{
    case: string
    row: Record<string, unknown>
    expected: Partial<ImportDraft>
    codes: ImportIssueCode[]
  }>([
    // Name
    {
      case: 'lowercase name',
      row: { name: 'bar of soap' },
      expected: { name: 'Bar of Soap' },
      codes: [],
    },
    { case: 'shouting name', row: { name: 'SHAMPOO' }, expected: { name: 'SHAMPOO' }, codes: [] },
    {
      case: 'extra whitespace is kept',
      row: { name: '  rose  hand cream ' },
      expected: { name: '  Rose  Hand Cream ' },
      codes: [],
    },
    { case: 'number as name', row: { name: 123 }, expected: { name: '123' }, codes: [] },
    {
      case: 'long name',
      row: { name: 'x'.repeat(100) },
      expected: { name: 'X' + 'x'.repeat(79) },
      codes: ['too-long'],
    },
    // Other text
    { case: 'number as size', row: { size: 500 }, expected: { size: '500' }, codes: [] },
    {
      case: 'object as brand',
      row: { brand: { name: 'Exampleside' } },
      expected: { brand: '' },
      codes: ['wrong-type'],
    },
    { case: 'null brand', row: { brand: null }, expected: { brand: '' }, codes: [] },
    {
      case: 'long shop',
      row: { shop: 's'.repeat(41) },
      expected: { shop: 's'.repeat(40) },
      codes: ['too-long'],
    },
    {
      case: 'note becomes reason',
      row: { note: 'Could be kitchen or bathroom' },
      expected: { reason: 'Could be kitchen or bathroom' },
      codes: [],
    },
    // Count
    { case: 'count as text', row: { count: '3' }, expected: { quantity: 3 }, codes: [] },
    { case: 'count with spaces', row: { count: ' 4 ' }, expected: { quantity: 4 }, codes: [] },
    {
      case: 'count as words',
      row: { count: 'three' },
      expected: { quantity: 1 },
      codes: ['count-adjusted'],
    },
    {
      case: 'negative count',
      row: { count: -2 },
      expected: { quantity: 1 },
      codes: ['count-adjusted'],
    },
    { case: 'zero count', row: { count: 0 }, expected: { quantity: 1 }, codes: ['count-adjusted'] },
    {
      case: 'fractional count',
      row: { count: 2.5 },
      expected: { quantity: 3 },
      codes: ['count-adjusted'],
    },
    { case: 'count of 99', row: { count: 99 }, expected: { quantity: 99 }, codes: [] },
    {
      case: 'large count',
      row: { count: 150 },
      expected: { quantity: 150 },
      codes: ['count-large'],
    },
    {
      case: 'large count as text',
      row: { count: '150' },
      expected: { quantity: 150 },
      codes: ['count-large'],
    },
    {
      case: 'count with a word after it',
      row: { count: '3 bottles' },
      expected: { quantity: 3 },
      codes: ['count-adjusted'],
    },
    {
      case: 'decimal count as text',
      row: { count: '2.5' },
      expected: { quantity: 2 },
      codes: ['count-adjusted'],
    },
    {
      case: 'negative count as text',
      row: { count: '-3' },
      expected: { quantity: 1 },
      codes: ['count-adjusted'],
    },
    {
      case: 'true as count',
      row: { count: true },
      expected: { quantity: 1 },
      codes: ['count-adjusted'],
    },
    { case: 'missing count', row: { count: undefined }, expected: { quantity: 1 }, codes: [] },
    // Category and group
    {
      case: 'wrong-case category',
      row: { cat: 'Kitchen' },
      expected: { category: 'household', group: 'Other' },
      codes: ['unknown-category', 'unknown-group'],
    },
    {
      case: 'old basics category',
      row: { cat: 'basics', sub: 'Paper Goods' },
      expected: { category: 'household', group: 'Other' },
      codes: ['unknown-category', 'unknown-group'],
    },
    {
      case: 'prototype-crashing category',
      row: { cat: 'toString' },
      expected: { category: 'household', group: 'Other' },
      codes: ['unknown-category', 'unknown-group'],
    },
    {
      case: 'fallback keeps a known group',
      row: { cat: 'cleaning', sub: 'Floors, Surfaces & Cloths' },
      expected: { category: 'household', group: 'Floors, Surfaces & Cloths' },
      codes: ['unknown-category'],
    },
    {
      case: 'wrong-case group',
      row: { cat: 'bathroom', sub: 'toilet paper' },
      expected: { category: 'bathroom', group: 'Cleaning' },
      codes: ['unknown-group'],
    },
    {
      case: 'group Other',
      row: { sub: 'Other' },
      expected: { category: 'kitchen', group: 'Other' },
      codes: [],
    },
    {
      case: 'missing group',
      row: { sub: undefined },
      expected: { group: 'Dishwashing' },
      codes: [],
    },
    {
      case: 'number as group',
      row: { cat: 'laundry', sub: 3 },
      expected: { group: 'Washing' },
      codes: ['unknown-group'],
    },
    // Unit
    { case: 'capitalised unit', row: { unit: 'Tube' }, expected: { unit: 'tube' }, codes: [] },
    { case: 'shouting unit', row: { unit: 'JAR' }, expected: { unit: 'jar' }, codes: [] },
    { case: 'own unit', row: { unit: 'Crate' }, expected: { unit: 'crate' }, codes: [] },
    { case: 'unit with a space', row: { unit: 'jar ' }, expected: { unit: 'jar' }, codes: [] },
    {
      case: 'own unit with spaces',
      row: { unit: '  Gift Box ' },
      expected: { unit: 'gift box' },
      codes: [],
    },
    { case: 'only spaces as unit', row: { unit: '   ' }, expected: { unit: 'bottle' }, codes: [] },
    {
      case: 'number as unit',
      row: { unit: 5 },
      expected: { unit: 'bottle' },
      codes: ['wrong-type'],
    },
    {
      case: 'long unit',
      row: { unit: 'extra large refill bag' }, // 22 characters, cut at 20 then trimmed
      expected: { unit: 'extra large refill b' },
      codes: ['too-long'],
    },
    {
      case: 'long unit cut on a space',
      row: { unit: 'extra large refills bag' }, // character 20 is a space, so it is trimmed off
      expected: { unit: 'extra large refills' },
      codes: ['too-long'],
    },
    { case: 'other known unit', row: { unit: 'refill' }, expected: { unit: 'refill' }, codes: [] },
    // Confidence and status
    {
      case: 'wrong-case confidence',
      row: { confidence: 'High' },
      expected: { confidence: 'medium' },
      codes: ['unknown-confidence'],
    },
    {
      case: 'low confidence',
      row: { confidence: 'low' },
      expected: { confidence: 'low' },
      codes: [],
    },
    { case: 'returned', row: { status: 'returned' }, expected: { mark: 'return' }, codes: [] },
    { case: 'cancelled', row: { status: 'cancelled' }, expected: { mark: 'return' }, codes: [] },
    {
      case: 'capitalised status',
      row: { status: 'Returned' },
      expected: { mark: 'return' },
      codes: [],
    },
    {
      case: 'shouting status',
      row: { status: 'CANCELLED' },
      expected: { mark: 'return' },
      codes: [],
    },
    {
      case: 'status with spaces',
      row: { status: ' Returned ' },
      expected: { mark: 'return' },
      codes: [],
    },
    { case: 'only spaces as status', row: { status: '  ' }, expected: { mark: 'mine' }, codes: [] },
    {
      case: 'status Shelfie doesn’t know',
      row: { status: 'Shipped' },
      expected: { mark: 'mine' },
      codes: ['unknown-status'],
    },
    { case: 'unknown status', row: { status: 'unknown' }, expected: { mark: 'mine' }, codes: [] },
    // Links
    {
      case: 'https link',
      row: { link: 'https://shop.example/lemon' },
      expected: { links: { product: 'https://shop.example/lemon' } },
      codes: [],
    },
    {
      case: 'http link is kept',
      row: { blink: 'http://brand.example' },
      expected: { links: { brand: 'http://brand.example' } },
      codes: [],
    },
    {
      case: 'javascript: link',
      row: { link: 'javascript:alert(1)' },
      expected: { links: {} },
      codes: ['link-scheme'],
    },
    {
      case: 'data: link',
      row: { blink: 'data:text/html,hi' },
      expected: { links: {} },
      codes: ['link-scheme'],
    },
    {
      case: 'link with spaces',
      row: { link: ' https://shop.example ' },
      expected: { links: {} },
      codes: ['link-scheme'],
    },
    { case: 'number as link', row: { link: 42 }, expected: { links: {} }, codes: ['link-scheme'] },
  ])('$case', ({ row, expected, codes }) => {
    const { draft, issues } = draftOf({ ...cleanRow, ...row })
    expect(draft).toMatchObject(expected)
    expect(issues.map((issue) => issue.code)).toEqual(codes)
  })

  it.each([
    { case: 'a real past date', date: '2026-10-31', boughtAt: '2026-10-31', codes: [] },
    { case: 'today', date: TODAY, boughtAt: TODAY, codes: [] },
    { case: 'the day after the floor', date: '2000-01-02', boughtAt: '2000-01-02', codes: [] },
    { case: 'empty', date: '', boughtAt: TODAY, codes: [] },
    { case: 'null', date: null, boughtAt: TODAY, codes: [] },
    { case: 'tomorrow', date: '2026-11-15', boughtAt: TODAY, codes: ['date-in-future'] },
    { case: 'next year', date: '2027-01-01', boughtAt: TODAY, codes: ['date-in-future'] },
    {
      case: 'the floor itself',
      date: '2000-01-01',
      boughtAt: TODAY,
      codes: ['date-too-old'],
    },
    { case: 'before 2000', date: '1999-06-01', boughtAt: TODAY, codes: ['date-too-old'] },
    {
      case: 'an impossible date',
      date: '2026-02-30',
      boughtAt: TODAY,
      codes: ['invalid-date'],
    },
    { case: 'another format', date: '14/11/2026', boughtAt: TODAY, codes: ['invalid-date'] },
    { case: 'with a time', date: '2026-11-01T10:00', boughtAt: TODAY, codes: ['invalid-date'] },
    { case: 'a number', date: 20261101, boughtAt: TODAY, codes: ['wrong-type'] },
  ] satisfies Array<{
    case: string
    date: unknown
    boughtAt: string
    codes: ImportIssueCode[]
  }>)('date: $case', ({ date, boughtAt, codes }) => {
    const { draft } = draftOf({ ...cleanRow, date })
    expect(draft.boughtAt).toBe(boughtAt)
    expect(codesOf({ ...cleanRow, date })).toEqual(codes)
  })

  it.each<{
    case: string
    alts: unknown
    expected: ImportDraft['alternatives']
    codes: ImportIssueCode[]
  }>([
    {
      case: 'two good shelves',
      alts: [
        { cat: 'bathroom', sub: 'Cleaning' },
        { cat: 'household', sub: 'Floors, Surfaces & Cloths' },
      ],
      expected: [
        { category: 'bathroom', group: 'Cleaning' },
        { category: 'household', group: 'Floors, Surfaces & Cloths' },
      ],
      codes: [],
    },
    {
      case: 'only the first two are kept',
      alts: [{ cat: 'bathroom' }, { cat: 'laundry' }, { cat: 'health' }],
      expected: [
        { category: 'bathroom', group: 'Other' },
        { category: 'laundry', group: 'Other' },
      ],
      codes: [],
    },
    {
      case: 'repeats and the row’s own shelf are dropped',
      alts: [
        { cat: 'kitchen', sub: 'Dishwashing' },
        { cat: 'bathroom' },
        { cat: 'bathroom', sub: 'nope' },
      ],
      expected: [{ category: 'bathroom', group: 'Other' }],
      codes: [],
    },
    {
      case: 'unknown shelves are dropped and reported',
      alts: [null, 'kitchen', { cat: 'basics' }, { cat: 'beauty', sub: 'Make-Up' }],
      expected: [{ category: 'beauty', group: 'Make-Up' }],
      codes: ['alternative-dropped', 'alternative-dropped', 'alternative-dropped'],
    },
    { case: 'not a list', alts: { cat: 'bathroom' }, expected: [], codes: ['wrong-type'] },
  ])('alternatives: $case', ({ alts, expected, codes }) => {
    const { draft, issues } = draftOf({ ...cleanRow, alts })
    expect(draft.alternatives).toEqual(expected)
    expect(issues.map((issue) => issue.code)).toEqual(codes)
  })

  it('reports every problem in a very messy row at once', () => {
    const messy = {
      name: '  lemon washing-up liquid',
      brand: ['Exampleside'],
      count: '-3',
      unit: 'BOTTLE',
      cat: 'Kitchen',
      date: '2027-01-01',
      link: 'javascript:void(0)',
      extra: 'ignored',
    }
    const { draft, issues } = draftOf(messy)
    expect(draft).toMatchObject({
      name: '  Lemon Washing-Up Liquid',
      brand: '',
      quantity: 1,
      unit: 'bottle',
      category: 'household',
      links: {},
    })
    expect(draft.boughtAt).toBe(TODAY)
    expect(draft).not.toHaveProperty('extra')
    expect(issues.map((issue) => `${issue.field}:${issue.code}`).sort()).toEqual(
      [
        'boughtAt:date-in-future',
        'brand:wrong-type',
        'category:unknown-category',
        'quantity:count-adjusted',
        'links.product:link-scheme',
      ].sort(),
    )
    for (const issue of issues) expect(issue.message).not.toBe('')
  })

  it.each([
    { case: 'a large count is a warning', row: { count: 150 }, severity: 'warning' },
    { case: 'a changed count is an error', row: { count: -2 }, severity: 'error' },
    { case: 'a future date is an error', row: { date: '2027-01-01' }, severity: 'error' },
    { case: 'a dropped link is an error', row: { link: 'javascript:alert(1)' }, severity: 'error' },
  ] as const)('$case', ({ row, severity }) => {
    const { issues } = draftOf({ ...cleanRow, ...row })
    expect(issues.map((issue) => issue.severity)).toEqual([severity])
  })

  it.each([
    {
      row: { date: '2027-01-01' },
      message: 'The purchase date (2027-01-01) is in the future, so today’s date was used instead.',
    },
    {
      row: { count: 150 },
      message: '150 is more than usual for one order line. Check the number is right.',
    },
    { row: { count: '3 bottles' }, message: '“3 bottles” was read as 3.' },
  ])('explains $row', ({ row, message }) => {
    expect(draftOf({ ...cleanRow, ...row }).issues[0]?.message).toBe(message)
  })

  it('never changes the row passed in', () => {
    const row = Object.freeze({
      ...cleanRow,
      alts: Object.freeze([Object.freeze({ cat: 'bathroom' })]),
    })
    expect(() => normRow(row, TODAY)).not.toThrow()
  })

  it('gives a draft calcStock accepts as it is', () => {
    const { draft } = draftOf(cleanRow)
    // 500 ml at 10 ml a day lasts 50 days; bought 13 days ago, so both are left.
    expect(calcStock(draft, TODAY)).toEqual({
      lifeDays: 50,
      used: 0,
      left: 2,
      startedOn: '2026-11-01',
    })
  })

  it('throws on an invalid today', () => {
    expect(() => normRow(cleanRow, '2026-13-01')).toThrow(InvalidDateError)
  })
})

describe('titleCase', () => {
  it.each([
    { text: 'vitamin c serum', expected: 'Vitamin C Serum' },
    { text: 'the bar of soap', expected: 'The Bar of Soap' },
    { text: 'washing-up liquid', expected: 'Washing-Up Liquid' },
    { text: 'SPF 50 sun cream', expected: 'SPF 50 Sun Cream' },
    { text: '', expected: '' },
    // Oddities kept
    { text: ' a soap', expected: ' a Soap' }, // small word after a leading space
    { text: 'crème', expected: 'CrèMe' }, // letters outside A-Z split words
  ])('"$text" → "$expected"', ({ text, expected }) => {
    expect(titleCase(text)).toBe(expected)
  })
})

describe('normalizeForMatch', () => {
  it.each([
    { text: '  Lemon   Washing-Up  Liquid! ', expected: 'lemon washing up liquid' },
    { text: 'Example & Co.', expected: 'example co' },
    { text: 'Crème', expected: 'cr me' },
    { text: '!!!', expected: '' },
  ])('"$text" → "$expected"', ({ text, expected }) => {
    expect(normalizeForMatch(text)).toBe(expected)
  })
})

describe('findMatch', () => {
  // Only the id, name and brand matter to findMatch.
  const storedItem = (id: string, name: string, brand: string): Item =>
    makeItem({ id, name, brand })

  const items: readonly Item[] = [
    storedItem('lemon', 'Lemon Washing-Up Liquid', 'Exampleside'),
    storedItem('pads', 'Cotton Pads', ''),
    storedItem('shampoo-example-botanics', 'Rosemary Shampoo', 'Example Botanics'),
    storedItem('shampoo-example-co', 'Rosemary Shampoo', 'Example & Co'),
    storedItem('creme', 'Creme Hydrante', ''),
    storedItem('soap-jp', '石鹸', ''),
  ]

  it.each([
    // Matches
    {
      case: 'same name and brand',
      name: 'Lemon Washing-Up Liquid',
      brand: 'Exampleside',
      id: 'lemon',
    },
    {
      case: 'different case and punctuation',
      name: 'lemon washing up liquid',
      brand: 'EXAMPLESIDE!',
      id: 'lemon',
    },
    {
      case: 'extra whitespace',
      name: '  Lemon   Washing-Up  Liquid ',
      brand: ' Exampleside',
      id: 'lemon',
    },
    { case: 'draft has no brand', name: 'Lemon Washing-Up Liquid', brand: '', id: 'lemon' },
    { case: 'item has no brand', name: 'Cotton Pads', brand: 'Examplecloud', id: 'pads' },
    {
      case: 'brand picks between same names',
      name: 'Rosemary Shampoo',
      brand: 'Example & Co',
      id: 'shampoo-example-co',
    },
    {
      case: 'no brand: first same name wins',
      name: 'Rosemary Shampoo',
      brand: '',
      id: 'shampoo-example-botanics',
    },
    // Near misses
    {
      case: 'different brand',
      name: 'Lemon Washing-Up Liquid',
      brand: 'Examplesparkle',
      id: undefined,
    },
    { case: 'singular', name: 'Cotton Pad', brand: '', id: undefined },
    { case: 'plural', name: 'Lemon Washing-Up Liquids', brand: '', id: undefined },
    { case: 'size in the name', name: 'Lemon Washing-Up Liquid 500ml', brand: '', id: undefined },
    {
      case: 'brand in the name',
      name: 'Exampleside Lemon Washing-Up Liquid',
      brand: '',
      id: undefined,
    },
    { case: 'shorter name', name: 'Washing-Up Liquid', brand: '', id: undefined },
    { case: 'one letter off', name: 'Lemon Washing-Up Liquad', brand: '', id: undefined },
    {
      case: 'brand differs by more than punctuation',
      name: 'Rosemary Shampoo',
      brand: 'Example and Co',
      id: undefined,
    },
    // Oddities kept
    { case: 'accent stops a match', name: 'Crème Hydrante', brand: '', id: undefined },
    {
      case: 'punctuation-only brand counts as none',
      name: 'Lemon Washing-Up Liquid',
      brand: '!!!',
      id: 'lemon',
    },
    { case: 'different non-Latin names match', name: 'シャンプー', brand: '', id: 'soap-jp' },
  ])('$case', ({ name, brand, id }) => {
    expect(findMatch({ name, brand }, items)?.id).toBe(id)
  })

  it('finds nothing among no items', () => {
    expect(findMatch({ name: 'Cotton Pads', brand: '' }, [])).toBeUndefined()
  })

  it('returns the stored item itself, and gives the same answer every time', () => {
    const draft = { name: 'cotton pads', brand: '' }
    expect(findMatch(draft, items)).toBe(items[1])
    expect(findMatch(draft, items)).toBe(findMatch(draft, items))
  })

  it('works on a draft straight from normRow', () => {
    const { draft } = draftOf({ ...cleanRow, name: 'lemon washing-up liquid', brand: '' })
    expect(findMatch(draft, items)?.id).toBe('lemon')
  })
})

describe('boundaries added in the test review', () => {
  it('reads a count of NaN as 1, and says so', () => {
    const { draft, issues } = draftOf({ ...cleanRow, count: Number.NaN })
    expect(draft.quantity).toBe(1)
    expect(issues.map((issue) => issue.code)).toEqual(['count-adjusted'])
  })
})
