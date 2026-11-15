// The status chip's wording (src/ui/status-label.ts). Invented data only.

import { describe, expect, it } from 'vitest'
import { plusDays } from '../../domain/dates'
import type { Item } from '../../domain/item'
import { TODAY, makeItem } from '../../domain/testing/helpers/fixtures'
import { statusLabel } from '../status-label'

/** One open bottle, 30-day life, reorder when 90% used. */
const open = (overrides: Partial<Item> = {}) =>
  makeItem({
    quantity: 1,
    lifeDays: 30,
    startedOn: plusDays(TODAY, -10),
    reorder: { kind: 'share', share: 0.9 },
    ...overrides,
  })

describe('statusLabel', () => {
  it.each([
    {
      case: 'expired yesterday',
      item: makeItem({ expiresOn: plusDays(TODAY, -1) }),
      label: { kind: 'expired', tone: 'bad', text: 'Expired 1 day ago' },
    },
    {
      case: 'expired 12 days ago',
      item: makeItem({ expiresOn: plusDays(TODAY, -12) }),
      label: { kind: 'expired', tone: 'bad', text: 'Expired 12 days ago' },
    },
    {
      case: 'out of stock',
      item: makeItem({ quantity: 0 }),
      label: { kind: 'out', tone: 'bad', text: 'Out of stock' },
    },
    {
      case: 'due by time',
      item: open({ startedOn: plusDays(TODAY, -27) }),
      label: { kind: 'order', tone: 'warn', text: 'Order now · 10% left' },
    },
    {
      case: 'due by time and past its estimate',
      item: open({ startedOn: plusDays(TODAY, -31) }),
      label: { kind: 'order', tone: 'bad', text: 'Order now · past estimate' },
    },
    {
      case: 'low by count',
      item: makeItem({ quantity: 1 }),
      label: { kind: 'low', tone: 'warn', text: 'Low · 1 left' },
    },
    {
      case: 'expiring in 25 days',
      item: makeItem({ expiresOn: plusDays(TODAY, 25) }),
      label: { kind: 'use-soon', tone: 'warn', text: 'Use within 25 days' },
    },
    {
      case: 'expiring tomorrow',
      item: makeItem({ expiresOn: plusDays(TODAY, 1) }),
      label: { kind: 'use-soon', tone: 'warn', text: 'Use within 1 day' },
    },
    {
      case: 'plenty, counted',
      item: makeItem({ quantity: 3 }),
      label: { kind: 'left', tone: 'ok', text: '3 left' },
    },
    {
      case: 'one open, reordered by share',
      item: open({ startedOn: plusDays(TODAY, -9) }),
      label: { kind: 'left', tone: 'ok', text: '70% left' },
    },
    {
      case: 'two in stock, reordered by share',
      item: open({ quantity: 2 }),
      label: { kind: 'left', tone: 'ok', text: '2 left' },
    },
  ] as const)('$case', ({ item, label }) => {
    expect(statusLabel(item, TODAY)).toEqual(label)
  })

  it('follows the domain priority: expired wins over out of stock', () => {
    const item = makeItem({ quantity: 0, expiresOn: plusDays(TODAY, -2) })
    expect(statusLabel(item, TODAY).kind).toBe('expired')
  })

  it('says out of stock, not low, at 0', () => {
    expect(
      statusLabel(makeItem({ quantity: 0, reorder: { kind: 'count', atOrBelow: 2 } }), TODAY),
    ).toMatchObject({ kind: 'out' })
  })
})
