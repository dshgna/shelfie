import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type Item } from './item'
import { isSafeLink, normalizeItem, validateItem, type IssueCode } from './validate'

// Invented example data, not anyone's real inventory. Valid as it stands.
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'test-item',
    name: 'Rosemary Shampoo',
    brand: 'Hilltop Botanics',
    category: 'hair',
    group: 'Shampoo',
    location: 'Shower caddy',
    quantity: 1,
    unit: 'bottle',
    size: '250 ml',
    lifeDays: 60,
    startedOn: '2026-09-01',
    reorder: { kind: 'count', atOrBelow: 1 },
    buyUpTo: 2,
    notes: '',
    links: {},
    isExample: false,
    ...overrides,
  }
}

function codes(item: Item): IssueCode[] {
  return validateItem(item).map((issue) => issue.code)
}

describe('validateItem', () => {
  it('reports nothing for a valid item', () => {
    expect(validateItem(makeItem())).toEqual([])
  })

  describe('start date', () => {
    it.each([
      { case: 'lifetime and stock', lifeDays: 60, quantity: 1, expected: [] },
      { case: 'no lifetime', lifeDays: undefined, quantity: 1, expected: ['start-without-life'] },
      { case: 'lifetime of 0', lifeDays: 0, quantity: 1, expected: ['start-without-life'] },
      { case: 'out of stock', lifeDays: 60, quantity: 0, expected: ['start-when-out-of-stock'] },
      {
        case: 'no lifetime and out of stock',
        lifeDays: undefined,
        quantity: 0,
        expected: ['start-without-life', 'start-when-out-of-stock'],
      },
    ])('with $case', ({ lifeDays, quantity, expected }) => {
      expect(codes(makeItem({ lifeDays, quantity, startedOn: '2026-09-01' }))).toEqual(expected)
    })

    it('reports nothing when there is no start date', () => {
      const item = makeItem({ lifeDays: undefined, quantity: 0, startedOn: undefined })
      expect(codes(item)).toEqual([])
    })
  })

  describe('reorder by share', () => {
    it.each([
      { case: 'a lifetime', lifeDays: 60, expected: [] },
      { case: 'no lifetime', lifeDays: undefined, expected: ['share-without-life'] },
      { case: 'a lifetime of 0', lifeDays: 0, expected: ['share-without-life'] },
    ])('with $case', ({ lifeDays, expected }) => {
      const reorder = { kind: 'share', share: 0.9 } as const
      const item = makeItem({ lifeDays, startedOn: undefined, reorder })
      expect(codes(item)).toEqual(expected)
    })

    it('does not need a lifetime when reordering by count', () => {
      expect(codes(makeItem({ lifeDays: undefined, startedOn: undefined }))).toEqual([])
    })
  })

  describe('whole numbers', () => {
    const fields = ['quantity', 'buyUpTo', 'lifeDays'] as const
    const values = [
      { value: 0, valid: true },
      { value: 1, valid: true },
      { value: 2.5, valid: false },
      { value: -1, valid: false },
      { value: Number.NaN, valid: false },
    ]
    const cases = fields.flatMap((field) => values.map((v) => ({ field, ...v })))

    it.each(cases)('$field = $value is valid: $valid', ({ field, value, valid }) => {
      // No start date, so the start rules can't add issues of their own.
      const overrides: Partial<Item> = { startedOn: undefined }
      overrides[field] = value
      const wholeNumberIssues = validateItem(makeItem(overrides)).filter(
        (issue) => issue.code === 'not-whole-number',
      )
      const expected = [{ field, code: 'not-whole-number', message: expect.any(String) }]
      expect(wholeNumberIssues).toEqual(valid ? [] : expected)
    })
  })

  describe('links', () => {
    it.each([
      { link: 'https://example.com/soap', valid: true },
      { link: 'http://example.com/soap', valid: true },
      { link: 'javascript:alert(1)', valid: false },
      { link: 'not a url', valid: false },
    ])('product and brand link $link is valid: $valid', ({ link, valid }) => {
      const item = makeItem({ links: { product: link, brand: link } })
      const expected = valid ? [] : ['link-scheme', 'link-scheme']
      expect(codes(item)).toEqual(expected)
      if (!valid) {
        expect(validateItem(item).map((i) => i.field)).toEqual(['links.product', 'links.brand'])
      }
    })
  })
})

describe('isSafeLink', () => {
  it.each([
    { url: 'https://example.com', ok: true, insecure: false },
    { url: 'https://example.com/path?q=1#top', ok: true, insecure: false },
    { url: 'HTTPS://EXAMPLE.COM', ok: true, insecure: false },
    { url: 'https://example.com:8443/shop', ok: true, insecure: false },
    { url: 'https://[::1]/', ok: true, insecure: false },
    { url: 'http://example.com', ok: true, insecure: true },
    { url: 'javascript:alert(1)', ok: false, insecure: false },
    { url: 'data:text/html,<b>hi</b>', ok: false, insecure: false },
    { url: 'file:///etc/hosts', ok: false, insecure: false },
    { url: 'ftp://example.com', ok: false, insecure: false },
    { url: 'not a url', ok: false, insecure: false },
    { url: '', ok: false, insecure: false },
    { url: 'example.com', ok: false, insecure: false },
    { url: 'https://', ok: false, insecure: false },
    { url: 'https:example.com', ok: false, insecure: false },
    { url: ' https://example.com', ok: false, insecure: false },
    { url: 'https://exa mple.com', ok: false, insecure: false },
    { url: 'https://shop.example@evil.example', ok: false, insecure: false },
    { url: 'https://example..com', ok: false, insecure: false },
    { url: 'https://example.com:99999', ok: false, insecure: false },
  ])('$url', ({ url, ok, insecure }) => {
    expect(isSafeLink(url)).toEqual({ ok, insecure })
  })
})

describe('normalizeItem', () => {
  it.each([
    { case: 'no lifetime', lifeDays: undefined, quantity: 1, keepsStart: false },
    { case: 'a lifetime of 0', lifeDays: 0, quantity: 1, keepsStart: false },
    { case: 'nothing in stock', lifeDays: 60, quantity: 0, keepsStart: false },
    { case: 'a lifetime and stock', lifeDays: 60, quantity: 1, keepsStart: true },
  ])('with $case, keeps the start date: $keepsStart', ({ lifeDays, quantity, keepsStart }) => {
    const result = normalizeItem(makeItem({ lifeDays, quantity, startedOn: '2026-09-01' }))
    expect(result.startedOn).toBe(keepsStart ? '2026-09-01' : undefined)
    expect('startedOn' in result).toBe(keepsStart)
    expect(codes(result)).not.toContain('start-without-life')
    expect(codes(result)).not.toContain('start-when-out-of-stock')
  })

  it('changes nothing else', () => {
    const input = makeItem({ lifeDays: undefined, links: { product: 'https://example.com' } })
    const expected: Item = { ...input }
    delete expected.startedOn
    expect(normalizeItem(input)).toEqual(expected)
  })

  it('never changes the item it is given', () => {
    const input = makeItem({ quantity: 0, links: { product: 'https://example.com' } })
    const before = JSON.parse(JSON.stringify(input)) as Item
    // Frozen objects throw if anything tries to change them.
    Object.freeze(input.links)
    Object.freeze(input.reorder)
    Object.freeze(input)

    const result = normalizeItem(input)

    expect(input).toEqual(before)
    expect(result).not.toBe(input)
    expect(result.links).not.toBe(input.links)
    expect(result.reorder).not.toBe(input.reorder)
  })
})
