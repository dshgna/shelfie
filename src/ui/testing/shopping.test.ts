// The Shopping tab's rules (src/ui/shopping.ts). Invented data only; links use the reserved
// .example top-level domain.

import { describe, expect, it } from 'vitest'
import { buyCount } from '../../domain/status'
import { TODAY, makeItem } from '../../domain/testing/helpers/fixtures'
import { groupByShop, listText, plural, shopLink, shoppingLines } from '../shopping'

// makeItem: 3 tubes, reorder at 1 left, buy up to 3. Quantity 0 is out of stock, so needs buying.
const out = (overrides: Parameters<typeof makeItem>[0] = {}) =>
  makeItem({ quantity: 0, ...overrides })

describe('shoppingLines', () => {
  it('lists only the items that need restocking', () => {
    const lines = shoppingLines(
      [makeItem({ id: 'full' }), out({ id: 'empty' }), makeItem({ id: 'low', quantity: 1 })],
      TODAY,
      {},
    )
    expect(lines.map((line) => line.item.id)).toEqual(['empty', 'low'])
  })

  it('sorts by category order, then by name', () => {
    const lines = shoppingLines(
      [
        out({ id: 'k-b', category: 'kitchen', name: 'Sponges' }),
        out({ id: 'k-a', category: 'kitchen', name: 'Dish Soap' }),
        out({ id: 's', category: 'skincare', name: 'Toner' }),
      ],
      TODAY,
      {},
    )
    expect(lines.map((line) => line.item.id)).toEqual(['s', 'k-a', 'k-b'])
  })

  it("buys buyCount's number unless the person changed it", () => {
    const a = out({ id: 'a', buyUpTo: 4 })
    const b = out({ id: 'b', buyUpTo: 4 })
    const lines = shoppingLines([a, b], TODAY, { b: 7 })
    expect(lines.map((line) => line.buy)).toEqual([buyCount(a), 7])
  })
})

describe('shopLink', () => {
  it('keeps an https link and names the shop without www', () => {
    expect(shopLink(makeItem({ link: 'https://www.corner-shop.example/soap' }))).toEqual({
      url: 'https://www.corner-shop.example/soap',
      host: 'corner-shop.example',
      upgraded: false,
    })
  })

  it('offers an http link as https, marked as unchecked', () => {
    expect(shopLink(makeItem({ link: 'http://refill.example/sponges' }))).toEqual({
      url: 'https://refill.example/sponges',
      host: 'refill.example',
      upgraded: true,
    })
  })

  it.each([
    { case: 'no link', link: undefined },
    { case: 'javascript:', link: 'javascript:alert(1)' },
    { case: 'data:', link: 'data:text/html,hi' },
    { case: 'not an address', link: 'corner shop' },
    { case: 'a user@ part', link: 'https://user@corner-shop.example/' },
  ])('gives no link for $case', ({ link }) => {
    expect(shopLink(makeItem(link === undefined ? {} : { link }))).toBeUndefined()
  })
})

describe('groupByShop', () => {
  it('groups by shop in the order shops first appear, then lists items without a link', () => {
    const lines = [
      { item: out({ id: 'a', link: 'https://corner-shop.example/a' }), buy: 1 },
      { item: out({ id: 'b', link: 'https://pharmacy.example/b' }), buy: 1 },
      { item: out({ id: 'c' }), buy: 2 },
      { item: out({ id: 'd', link: 'https://www.corner-shop.example/d' }), buy: 3 },
      { item: out({ id: 'e', link: 'javascript:alert(1)' }), buy: 1 },
    ]
    const { shops, none } = groupByShop(lines)
    expect(shops.map((shop) => [shop.host, shop.lines.map((line) => line.item.id)])).toEqual([
      ['corner-shop.example', ['a', 'd']],
      ['pharmacy.example', ['b']],
    ])
    expect(shops[0]?.lines[1]).toMatchObject({ buy: 3, link: { upgraded: false } })
    expect(none.map((line) => line.item.id)).toEqual(['c', 'e'])
  })

  it('gives no shops for an empty list', () => {
    expect(groupByShop([])).toEqual({ shops: [], none: [] })
  })
})

describe('plural', () => {
  it.each([
    ['bottle', 1, 'bottle'],
    ['bottle', 2, 'bottles'],
    ['box', 3, 'boxes'],
    ['brush', 2, 'brushes'],
    ['pouch', 2, 'pouches'],
    ['glass', 2, 'glasses'],
    ['', 2, ''],
  ] as const)('%s × %i is "%s"', (unit, count, expected) => {
    expect(plural(unit, count)).toBe(expected)
  })
})

describe('listText', () => {
  it('writes one line per item with how many and the unit', () => {
    const text = listText([
      { item: makeItem({ name: 'Oat Shampoo', unit: 'bottle' }), buy: 1 },
      { item: makeItem({ name: 'Kitchen Sponges', unit: 'sponge' }), buy: 2 },
      { item: makeItem({ name: 'Mystery', unit: '' }), buy: 3 },
    ])
    expect(text).toBe(
      [
        'Shopping list',
        '- Oat Shampoo x1 (bottle)',
        '- Kitchen Sponges x2 (sponges)',
        '- Mystery x3',
      ].join('\n'),
    )
  })

  it('is just the heading for an empty list', () => {
    expect(listText([])).toBe('Shopping list')
  })
})
